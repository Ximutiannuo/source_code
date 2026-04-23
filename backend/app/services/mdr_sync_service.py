import logging
from datetime import datetime
from sqlalchemy import text
from app.database import default_engine
import time

logger = logging.getLogger(__name__)

class MDRSyncService:
    @staticmethod
    def sync_mdr_data():
        """
        同步 ENG.ENGDB 到 projectcontrols.ext_eng_db_current
        集成全量预计算逻辑
        """
        from app.services.system_task_service import SystemTaskService
        SystemTaskService.set_task_lock("mdr_sync", True, updated_by="MDRSyncService")
        
        try:
            start_time = datetime.now()
            logger.info(f"开始同步 MDR 设计数据: {start_time}")
            
            batch_size = 100000 
            
            block_sql = """
                CONCAT(
                    LPAD(TRIM(COALESCE(`CIA Code`, '0')), 4, '0'), '-',
                    LPAD(TRIM(COALESCE(`Facility`, '0')), 5, '0'), '-',
                    LPAD(TRIM(COALESCE(`Subtitle`, '0')), 2, '0')
                )
            """

            with default_engine.connect() as conn:
                log_id = None
                try:
                    # 0. 准备工作
                    conn.execute(text("UPDATE mdr_sync_log SET status = 'failed', message = '同步意外中断' WHERE status = 'running'"))
                    conn.execute(text("SET SESSION innodb_lock_wait_timeout = 600"))
                    conn.execute(text("SET SESSION sql_mode = ''"))
                    conn.commit()

                    # 1. 初始化日志
                    conn.execute(text("""
                        INSERT INTO mdr_sync_log (sync_time, status, total_count, processed_count, message)
                        VALUES (:sync_time, 'running', 0, 0, '正在初始化同步任务...')
                    """), {"sync_time": start_time})
                    conn.commit()
                    log_id = conn.execute(text("SELECT LAST_INSERT_ID()")).scalar()

                    # 2. 获取总数
                    conn.execute(text("UPDATE mdr_sync_log SET message = '正在连接源数据库并计算总行数...' WHERE id = :id"), {"id": log_id})
                    conn.commit()
                    res = conn.execute(text("SELECT MIN(ID), MAX(ID), COUNT(*) FROM ENG.ENGDB"))
                    min_id, max_id, total_count = res.fetchone()
                    
                    if total_count == 0:
                        conn.execute(text("UPDATE mdr_sync_log SET status = 'success', message = '源表为空' WHERE id = :id"), {"id": log_id})
                        conn.commit()
                        return {"success": True, "count": 0}

                    conn.execute(text("UPDATE mdr_sync_log SET total_count = :total, message = '正在备份上周历史数据...' WHERE id = :id"), 
                                 {"total": total_count, "id": log_id})
                    conn.commit()
                    
                    # 3. 数据旋转（备份当前表到 previous，便于后续 Delta 计算）
                    conn.execute(text("TRUNCATE ext_eng_db_previous"))
                    conn.commit()
                    res_curr = conn.execute(text("SELECT MIN(id), MAX(id) FROM ext_eng_db_current"))
                    curr_min, curr_max = res_curr.fetchone()
                    if curr_min is not None:
                        backup_starts = list(range(curr_min, curr_max + 1, batch_size))
                        total_backup_batches = len(backup_starts)
                        for batch_idx, start in enumerate(backup_starts, 1):
                            conn.execute(text(f"INSERT INTO ext_eng_db_previous SELECT * FROM ext_eng_db_current WHERE id >= {start} AND id < {start + batch_size}"))
                            conn.commit()
                            # 更新进度到 mdr_sync_log，前端可显示“第 n/总 批”
                            conn.execute(text("""
                                UPDATE mdr_sync_log SET message = :msg WHERE id = :id
                            """), {"msg": f"正在备份上周历史数据... 第 {batch_idx}/{total_backup_batches} 批", "id": log_id})
                            conn.commit()
                            # 增加心跳
                            SystemTaskService.set_task_lock("mdr_sync", True, updated_by="MDRSyncService", remarks="正在备份历史数据...", quiet=True)
                    
                    conn.execute(text("TRUNCATE ext_eng_db_current"))
                    conn.commit()

                    # 4. 执行同步
                    processed_in_db = 0
                    for start in range(min_id, max_id + 1, batch_size):
                        end = start + batch_size
                        sync_sql = f"""
                        INSERT INTO ext_eng_db_current (
                            id, document_key, dwg_status, contract_code, originator_code, 
                            subclass, discipline, facility, subtitle, marka_code, 
                            cia_code, document_type, document_serial_number, document_number, 
                            document_title, document_class, document_language, payment_milestone_id, 
                            subcontractor_responsible, contractor_responsible, schedule_activity_id, 
                            progress_plan, progress_actual, access_code, phase, 
                            package, notes, type_of_document, type_of_dates, dates, 
                            review_code, calculated_block
                        )
                        SELECT 
                            ID, `Document Key`, `DWGStatus`, `Contract Code`, `Originator Code`,
                            `Subclass`, `Discipline`, `Facility`, `Subtitle`, TRIM(`Marka Code`),
                            `CIA Code`, `Document Type`, `Document Serial Number`, `Document Number`,
                            `Document Title`, `Document Class`, `Document Language`, 
                            `Payment milestone ID between Contractor and Subcontractor`,
                            `Subcontractor's Responsible`, `Contractor's Responsible`, `Schedule Activity ID`,
                            `Current progress in developing documentation Plan`, 
                            `Current progress in developing documentation Actual`,
                            `Access Code`, `Phase`, `Package`, `Notes`, `Type of Document`,
                            `Type of Dates`, NULLIF(`Dates`, '0000-00-00'), `Review Code`,
                            {block_sql}
                        FROM ENG.ENGDB
                        WHERE ID >= {start} AND ID < {end}
                        """
                        conn.execute(text(sync_sql))
                        processed_in_db = conn.execute(text("SELECT COUNT(*) FROM ext_eng_db_current")).scalar()
                        
                        conn.execute(text("""
                            UPDATE mdr_sync_log 
                            SET processed_count = :processed, message = :msg 
                            WHERE id = :id
                        """), {
                            "processed": processed_in_db, 
                            "msg": f"正在拉取数据: 已处理 {processed_in_db:,} / {total_count:,} 行", 
                            "id": log_id
                        })
                        conn.commit()
                        
                        # 增加心跳
                        SystemTaskService.set_task_lock("mdr_sync", True, updated_by="MDRSyncService", remarks=f"正在拉取数据: {processed_in_db:,}/{total_count:,}", quiet=True)

                    # 5. 执行预计算步骤 (分步更新 message)
                    conn.execute(text("UPDATE mdr_sync_log SET message = '数据拉取完成，正在生成聚合分析汇总...' WHERE id = :id"), {"id": log_id})
                    conn.commit()
                    SystemTaskService.set_task_lock("mdr_sync", True, updated_by="MDRSyncService", remarks="正在生成聚合分析汇总...", quiet=True)
                    MDRSyncService._run_analysis(conn)
                    
                    conn.execute(text("UPDATE mdr_sync_log SET message = '正在预计算周同比变动 (Delta Cache)...' WHERE id = :id"), {"id": log_id})
                    conn.commit()
                    SystemTaskService.set_task_lock("mdr_sync", True, updated_by="MDRSyncService", remarks="正在预计算周同比变动...", quiet=True)
                    MDRSyncService._run_delta_cache(conn)

                    conn.execute(text("UPDATE mdr_sync_log SET message = '正在预计算 S 曲线 (SCurve Cache)...' WHERE id = :id"), {"id": log_id})
                    conn.commit()
                    SystemTaskService.set_task_lock("mdr_sync", True, updated_by="MDRSyncService", remarks="正在预计算 S 曲线...", quiet=True)
                    MDRSyncService._run_scurve_cache(conn)

                    conn.execute(text("UPDATE mdr_sync_log SET message = '正在刷新 DDD 统计缓存...' WHERE id = :id"), {"id": log_id})
                    conn.commit()
                    SystemTaskService.set_task_lock("mdr_sync", True, updated_by="MDRSyncService", remarks="正在刷新 DDD 统计缓存...", quiet=True)
                    MDRSyncService._run_ddd_stats_cache(conn)
                    
                    # 6. 成功结束
                    duration = (datetime.now() - start_time).total_seconds()
                    conn.execute(text("""
                        UPDATE mdr_sync_log 
                        SET status = 'success', message = '同步完成', duration_seconds = :duration, processed_count = :total
                        WHERE id = :id
                    """), {"duration": int(duration), "total": processed_in_db, "id": log_id})
                    conn.commit()

                    logger.info(f"MDR 同步成功，耗时 {duration:.2f}秒")
                    return {"success": True, "count": processed_in_db, "duration": duration}

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"MDR 同步失败: {error_msg}", exc_info=True)
                    if log_id:
                        try:
                            conn.execute(text("UPDATE mdr_sync_log SET status = 'failed', message = :msg WHERE id = :id"), 
                                         {"msg": error_msg[:500], "id": log_id})
                            conn.commit()
                        except: pass
                    return {"success": False, "error": error_msg}
        finally:
            SystemTaskService.set_task_lock("mdr_sync", False)

    @staticmethod
    def _run_analysis(conn):
        conn.execute(text("DELETE FROM mdr_analysis_summary WHERE analysis_date = CURDATE()"))
        ifc_actual_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Actual'
        ifc_plan_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Plan'
        ifc_forecast_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Forecast'
        analysis_sql = """
        INSERT INTO mdr_analysis_summary (
            analysis_date, originator_code, discipline, document_type,
            total_dwg, plan_count, forecast_count, actual_count, review_a_count
        )
        SELECT 
            CURDATE(), originator_code, discipline, document_type,
            COUNT(DISTINCT document_number),
            SUM(CASE WHEN type_of_dates = :plan_type AND dates IS NOT NULL AND dates > '1900-01-01' THEN 1 ELSE 0 END),
            SUM(CASE WHEN type_of_dates = :forecast_type AND dates IS NOT NULL AND dates > '1900-01-01' THEN 1 ELSE 0 END),
            SUM(CASE WHEN type_of_dates = :actual_type AND dates IS NOT NULL AND dates > '1900-01-01' THEN 1 ELSE 0 END),
            SUM(CASE WHEN type_of_dates LIKE '%%Review%%' AND review_code = 'A' AND dates IS NOT NULL AND dates > '1900-01-01' THEN 1 ELSE 0 END)
        FROM ext_eng_db_current
        GROUP BY originator_code, discipline, document_type
        """
        conn.execute(text(analysis_sql), {"plan_type": ifc_plan_type, "forecast_type": ifc_forecast_type, "actual_type": ifc_actual_type})

    @staticmethod
    def _run_delta_cache(conn):
        import time
        start_time = time.time()
        logger.info("开始执行 Delta Cache 预计算...")
        
        # 设置查询超时（10分钟）
        conn.execute(text("SET SESSION max_execution_time = 600000"))  # 10分钟，单位是毫秒
        conn.execute(text("SET SESSION innodb_lock_wait_timeout = 600"))
        
        conn.execute(text("TRUNCATE mdr_delta_cache"))
        logger.info("已清空 mdr_delta_cache 表")
        
        ifc_actual_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Actual'
        ifc_plan_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Plan'
        
        # 优化：先检查是否有必要的索引，如果没有则提示
        try:
            # 检查索引是否存在
            index_check = conn.execute(text("""
                SELECT COUNT(*) as cnt FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'ext_eng_db_current' 
                AND index_name = 'idx_doc_type'
            """))
            has_index = index_check.scalar() > 0
            
            if not has_index:
                logger.warning("⚠️  未找到 idx_doc_type 索引，Delta Cache 计算可能会很慢。建议运行 optimize_mdr_indexes.py 添加索引。")
        except Exception as e:
            logger.warning(f"检查索引时出错: {e}")
        
        # 优化策略：使用临时表减少JOIN数据量
        # 1. 先创建临时表，只包含需要的字段和JOIN键
        logger.info("正在创建临时表以优化JOIN性能...")
        try:
            # 创建当前表的临时视图（只包含需要的字段）
            conn.execute(text("""
                CREATE TEMPORARY TABLE IF NOT EXISTS temp_curr_delta AS
                SELECT 
                    document_number,
                    type_of_dates,
                    originator_code,
                    discipline,
                    dates
                FROM ext_eng_db_current
                WHERE type_of_dates IN (:actual_type, :plan_type)
            """), {"actual_type": ifc_actual_type, "plan_type": ifc_plan_type})
            
            # 创建历史表的临时视图（只包含需要的字段）
            conn.execute(text("""
                CREATE TEMPORARY TABLE IF NOT EXISTS temp_prev_delta AS
                SELECT 
                    document_number,
                    type_of_dates,
                    dates
                FROM ext_eng_db_previous
                WHERE type_of_dates IN (:actual_type, :plan_type)
            """), {"actual_type": ifc_actual_type, "plan_type": ifc_plan_type})
            
            # 为临时表添加索引
            try:
                conn.execute(text("CREATE INDEX idx_temp_curr ON temp_curr_delta (document_number, type_of_dates(50))"))
                conn.execute(text("CREATE INDEX idx_temp_prev ON temp_prev_delta (document_number, type_of_dates(50))"))
            except Exception as e:
                logger.warning(f"创建临时表索引时出错（可能已存在）: {e}")
            
            logger.info("临时表创建完成，开始执行Delta Cache查询...")
        except Exception as e:
            logger.warning(f"创建临时表失败，将使用原表查询: {e}")
            # 如果临时表创建失败，使用原查询
            temp_curr_delta = "ext_eng_db_current"
            temp_prev_delta = "ext_eng_db_previous"
        else:
            temp_curr_delta = "temp_curr_delta"
            temp_prev_delta = "temp_prev_delta"
        
        # 2. 使用临时表执行JOIN（数据量大幅减少）
        cache_sql = f"""
            INSERT INTO mdr_delta_cache (originator_code, discipline, new_completed, accelerated, `delayed`, updated_at)
            SELECT 
                curr.originator_code, curr.discipline,
                SUM(CASE WHEN curr.type_of_dates = :actual_type AND curr.dates IS NOT NULL AND (prev.dates IS NULL OR prev.dates <= '1900-01-01') THEN 1 ELSE 0 END),
                SUM(CASE WHEN curr.type_of_dates = :plan_type AND curr.dates IS NOT NULL AND prev.dates IS NOT NULL AND curr.dates < prev.dates THEN 1 ELSE 0 END),
                SUM(CASE WHEN curr.type_of_dates = :plan_type AND curr.dates IS NOT NULL AND prev.dates IS NOT NULL AND curr.dates > prev.dates THEN 1 ELSE 0 END),
                NOW()
            FROM {temp_curr_delta} curr
            LEFT JOIN {temp_prev_delta} prev ON curr.document_number = prev.document_number AND curr.type_of_dates = prev.type_of_dates
            GROUP BY curr.originator_code, curr.discipline
        """
        
        logger.info("正在执行 Delta Cache 查询（这可能需要几分钟，请耐心等待）...")
        try:
            conn.execute(text(cache_sql), {"actual_type": ifc_actual_type, "plan_type": ifc_plan_type})
            conn.commit()
            elapsed = time.time() - start_time
            logger.info(f"✅ Delta Cache 预计算完成，耗时 {elapsed:.2f} 秒")
            
            # 清理临时表
            try:
                conn.execute(text("DROP TEMPORARY TABLE IF EXISTS temp_curr_delta"))
                conn.execute(text("DROP TEMPORARY TABLE IF EXISTS temp_prev_delta"))
            except Exception as e:
                logger.warning(f"清理临时表时出错: {e}")
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"❌ Delta Cache 预计算失败，耗时 {elapsed:.2f} 秒: {e}")
            # 清理临时表
            try:
                conn.execute(text("DROP TEMPORARY TABLE IF EXISTS temp_curr_delta"))
                conn.execute(text("DROP TEMPORARY TABLE IF EXISTS temp_prev_delta"))
            except:
                pass
            raise

    @staticmethod
    def _run_scurve_cache(conn):
        conn.execute(text("TRUNCATE mdr_scurve_cache"))
        ifc_actual_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Actual'
        ifc_plan_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Plan'
        ifc_forecast_type = 'Date of Document with issue purpose  IFH, IFD, IFP, IFU, IFC, IFI. Forecast'
        scurve_sql = """
        INSERT INTO mdr_scurve_cache (originator_code, discipline, month, p_count, f_count, a_count)
        SELECT 
            originator_code, discipline, DATE_FORMAT(dates, '%Y-%m') as m,
            SUM(CASE WHEN type_of_dates = :plan_type THEN 1 ELSE 0 END),
            SUM(CASE WHEN type_of_dates = :forecast_type THEN 1 ELSE 0 END),
            SUM(CASE WHEN type_of_dates = :actual_type THEN 1 ELSE 0 END)
        FROM ext_eng_db_current
        WHERE dates IS NOT NULL AND dates > '1900-01-01'
        GROUP BY originator_code, discipline, m
        """
        conn.execute(text(scurve_sql), {"plan_type": ifc_plan_type, "forecast_type": ifc_forecast_type, "actual_type": ifc_actual_type})
        conn.commit()

    @staticmethod
    def _run_ddd_stats_cache(conn):
        """刷新 DDD 统计缓存表（1 行），供首页 E 板块只读，避免对 300 万行 ext_eng_db_current 实时聚合。"""
        from app.services.dashboard_service import _ddd_aggregation_sql
        try:
            conn.execute(text("SET SESSION max_execution_time = 600000"))  # 10 分钟
            sql = text(_ddd_aggregation_sql())
            row = conn.execute(sql).fetchone()
            if not row:
                return
            conn.execute(text("""
                INSERT INTO ddd_stats_cache (id, total, ifr, ifc, ifc_a, mac_total, mac_ifc_a, kisto_total, kisto_ifc_a)
                VALUES (1, :t, :ifr, :ifc, :ifc_a, :mt, :ma, :kt, :ka)
                ON DUPLICATE KEY UPDATE
                  total = VALUES(total), ifr = VALUES(ifr), ifc = VALUES(ifc), ifc_a = VALUES(ifc_a),
                  mac_total = VALUES(mac_total), mac_ifc_a = VALUES(mac_ifc_a),
                  kisto_total = VALUES(kisto_total), kisto_ifc_a = VALUES(kisto_ifc_a),
                  updated_at = CURRENT_TIMESTAMP
            """), {
                "t": row[0] or 0, "ifr": row[1] or 0, "ifc": row[2] or 0, "ifc_a": row[3] or 0,
                "mt": row[4] or 0, "ma": row[5] or 0, "kt": row[6] or 0, "ka": row[7] or 0,
            })
            conn.commit()
            logger.info("DDD 统计缓存已刷新")
        except Exception as e:
            logger.warning(f"刷新 DDD 统计缓存失败（表 ddd_stats_cache 可能未建）: {e}")
            try:
                conn.rollback()
            except Exception:
                pass
