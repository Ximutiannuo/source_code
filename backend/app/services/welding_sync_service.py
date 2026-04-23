"""
焊接数据同步服务
从PRECOMCONTROL数据库的WeldingList表读取数据，同步PI04和PI05的完成量到VFACTDB
"""
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from sqlalchemy.exc import OperationalError
from app.database import get_db, SessionLocal
from app.database_precomcontrol import get_precomcontrol_db
from app.models.report import VFACTDB
from app.models.activity_summary import ActivitySummary
from app.models.welding_config import WeldingMarkaCode, WeldingNonStandardDrawing, WeldingConstContractorMapping
from app.models.workstep import WorkStepDefine
from datetime import date, datetime
from decimal import Decimal
from typing import List, Dict, Optional, Set, Tuple, Callable
from app.utils.timezone import now as system_now
import logging
import re
import time
import pymysql

logger = logging.getLogger(__name__)


class WeldingSyncService:
    """焊接数据同步服务类"""
    
    def __init__(self, db: Optional[Session] = None):
        """
        初始化，从数据库加载配置
        
        Args:
            db: 数据库会话，如果为None则创建新的会话
        """
        self.db = db if db else SessionLocal()
        self.non_standard_drawings: Set[str] = set()
        self.non_standard_drawings_map: Dict[tuple, Dict] = {}  # {(drawing_number, joint_type_fs): {joint_type_fs, activity_id}}
        self.marka_codes: Set[str] = set()
        self.constcontractor_mapping: Dict[str, str] = {}
        self._load_config()
    
    def _load_config(self):
        """从数据库加载配置"""
        try:
            should_close = False
            if not self.db:
                self.db = SessionLocal()
                should_close = True
            
            try:
                # 加载 Marka代码
                marka_items = self.db.query(WeldingMarkaCode).all()
                self.marka_codes = {item.marka for item in marka_items}
                logger.info(f"从数据库加载了 {len(self.marka_codes)} 个Marka代码")
                
                # 加载非标准图纸
                # 注意：同一个drawing_number可能有多个记录（S和F两种JointTypeFS）
                # 所以使用 (drawing_number, joint_type_fs) 作为key
                non_standard_items = self.db.query(WeldingNonStandardDrawing).all()
                self.non_standard_drawings = {item.drawing_number for item in non_standard_items}
                # 使用 (drawing_number, joint_type_fs) 作为key，支持同一个图纸有多个JointTypeFS
                self.non_standard_drawings_map = {
                    (item.drawing_number, item.joint_type_fs): {
                        'joint_type_fs': item.joint_type_fs,
                        'activity_id': item.activity_id
                    }
                    for item in non_standard_items
                }
                logger.info(f"从数据库加载了 {len(self.non_standard_drawings)} 个非标准图纸")
                
                # 加载ConstContractor映射
                mapping_items = self.db.query(WeldingConstContractorMapping).all()
                self.constcontractor_mapping = {item.constcontractor: item.scope for item in mapping_items}
                logger.info(f"从数据库加载了 {len(self.constcontractor_mapping)} 个ConstContractor映射")
                
            finally:
                if should_close:
                    self.db.close()
                    self.db = None
        except Exception as e:
            logger.error(f"加载配置失败: {e}", exc_info=True)
    
    def _extract_marka_from_drawing(self, drawing_number: str) -> Optional[str]:
        """
        从DrawingNumber中提取Marka
        
        标准格式: "GCC-AFT-DDD-13220-00-5200-TKM-ISO-00001"
        Marka通常在 \\d{5}-\\d{2}-\\d{4}- 之后
        例如: 13220-00-5200-TKM → Marka是TKM
        
        如果找不到 \\d{5}-\\d{2}-\\d{4}- 模式，说明是非标准图纸，
        应该去非标准图纸库查找activity_id
        """
        if not drawing_number:
            return None
        
        # 先检查是否在非标准图纸库中
        if drawing_number in self.non_standard_drawings:
            # 非标准图纸：不需要提取Marka，直接使用非标准图纸库中的activity_id
            logger.debug(f"非标准图纸，跳过Marka提取: {drawing_number}")
            return None
        
        # 标准图纸：查找 \\d{5}-\\d{2}-\\d{4}- 模式
        # 例如: 13220-00-5200-TKM
        pattern = r'\d{5}-\d{2}-\d{4}-([A-Z0-9]{2,5})'
        match = re.search(pattern, drawing_number)
        if match:
            marka = match.group(1).upper()
            # 排除VK/NVK/OVK/NV*/NK*开头的Marka（这些不应该进入系统）
            if marka.startswith(('VK', 'NVK', 'OVK')) or marka.startswith('NV') or marka.startswith('NK'):
                logger.debug(f"排除VK/NVK/OVK/NV*/NK*开头的Marka: {marka}")
                return None
            return marka
        
        # 如果找不到标准模式，返回None（可能是非标准图纸但未在库中）
        logger.debug(f"未找到标准Marka模式: {drawing_number}")
        return None
    
    def _extract_block_from_drawing(self, drawing_number: str, block: Optional[str] = None) -> Optional[str]:
        """
        从DrawingNumber中提取Block，如果block字段格式正确则直接使用
        Block格式应该是: ____-_____-__ (例如: 1307-12100-21)
        """
        # 如果block字段格式正确，直接使用
        if block and re.match(r'^\d{4}-\d{5}-\d{2}$', block):
            return block
        
        # 否则从DrawingNumber中提取
        if not drawing_number:
            return None
        
        # 检查是否在非标准图纸列表中
        if drawing_number in self.non_standard_drawings:
            # 非标准图纸需要特殊处理
            # 这里可以根据实际需求实现特殊逻辑
            logger.debug(f"非标准图纸: {drawing_number}")
        
        # 尝试从DrawingNumber中提取block格式
        # 例如: "GCC-ECU-MDR-11412CBIPR01-E06-00001" 或 "1307-12100-21-PI-TKM"
        # 查找格式: 数字-数字-数字
        matches = re.findall(r'\d{4}-\d{5}-\d{2}', drawing_number)
        if matches:
            return matches[0]
        
        # 尝试其他模式
        # 例如: "1307-12100-21"
        matches = re.findall(r'(\d{3,4}-\d{4,5}-\d{1,2})', drawing_number)
        if matches:
            return matches[0]
        
        return None
    
    def _should_include_drawing(self, drawing_number: str) -> bool:
        """判断图纸是否应该纳入PI04/PI05"""
        marka = self._extract_marka_from_drawing(drawing_number)
        if not marka:
            return False
        return marka in self.marka_codes
    
    def sync_pi04_pi05_from_welding_list(
        self,
        target_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        db: Session = None,
        progress_callback: Optional[callable] = None  # 进度回调函数
    ) -> Dict[str, any]:
        """
        从WeldingList表同步PI04和PI05数据到VFACTDB
        """
        from app.services.system_task_service import SystemTaskService
        
        # 避让逻辑：如果用户正在上传日报，焊接同步主动避让，避免 vfactdb 上的死锁
        if SystemTaskService.is_task_active("daily_report_upload"):
            logger.warning("[避让] 检测到用户正在上传日报，焊接同步主动放弃，请稍后手动触发或等待下次周期")
            return {
                "success": False,
                "message": "检测到用户正在上传日报，为避免数据库死锁，焊接同步已主动避让。请在日报上传完成后再试。",
                "skipped": True
            }

        SystemTaskService.set_task_lock("welding_sync", True, updated_by="WeldingSyncService")
        
        should_close = False
        try:
            if db is None:
                from app.database import SessionLocal
                db = SessionLocal()
                should_close = True
            
            # 确定日期范围
            date_range_str = "全部时间段"
            delete_date_range = None
            
            if target_date:
                # 单天模式
                date_range_str = f"日期 {target_date.isoformat()}"
                delete_date_range = (target_date, target_date)
            elif start_date and end_date:
                # 日期范围模式
                date_range_str = f"日期范围 {start_date.isoformat()} 至 {end_date.isoformat()}"
                delete_date_range = (start_date, end_date)
            # 否则是全部时间段模式，delete_date_range 为 None（删除所有）
            
            # 0. 预加载ActivitySummary到字典中（性能优化）
            if progress_callback:
                progress_callback(0, "正在预加载Activity数据...")
            logger.info("开始预加载ActivitySummary数据到内存...")
            activity_cache = {}  # {activity_id: ActivitySummary}
            try:
                # 添加查询超时（60秒），避免长时间占用连接
                all_activities = db.query(ActivitySummary).filter(
                    ActivitySummary.work_package.in_(['PI04', 'PI05'])
                ).execution_options(timeout=60).all()
                for activity in all_activities:
                    activity_cache[activity.activity_id] = activity
                logger.info(f"预加载了 {len(activity_cache)} 个Activity到内存")
            except Exception as e:
                logger.error(f"预加载Activity数据失败: {e}", exc_info=True)
                # 如果预加载失败，继续执行，但activity_cache为空，后续会从数据库查询
                logger.warning("将使用实时查询Activity数据（性能可能较慢）")
            if progress_callback:
                progress_callback(5, f"已预加载 {len(activity_cache)} 个Activity")
            
            # 1. 从PRECOMCONTROL数据库读取WeldingList数据
            read_result = self._read_welding_list_data(
                target_date=target_date,
                start_date=start_date,
                end_date=end_date,
                progress_callback=progress_callback
            )
            
            # read_result是字典，包含welding_data、unprocessed_drawings和统计信息
            welding_data = read_result.get('welding_data', [])
            unprocessed_drawings = read_result.get('unprocessed_drawings', [])
            read_statistics = read_result.get('statistics', {})
            
            logger.info(f"从WeldingList读取到 {len(welding_data)} 条数据（{date_range_str}）")
            logger.info(f"无法处理的图纸数量: {len(unprocessed_drawings)}")
            
            # 2. 删除现有的PI04和PI05数据
            if progress_callback:
                progress_callback(40, "正在删除现有PI04/PI05数据...")
            
            affected_ids_from_deletion = set()
            if delete_date_range:
                # 删除指定日期范围的数据
                deleted_count, affected_ids_from_deletion = self._delete_existing_pi04_pi05(
                    db,
                    start_date=delete_date_range[0],
                    end_date=delete_date_range[1]
                )
            else:
                # 删除所有PI04/PI05数据
                deleted_count, affected_ids_from_deletion = self._delete_existing_pi04_pi05(db)
            
            if progress_callback:
                progress_callback(45, f"已删除 {deleted_count} 条现有数据，涉及 {len(affected_ids_from_deletion)} 个作业")
            
            # 3. 将WeldingList数据转换为VFACTDB格式并插入
            if progress_callback:
                progress_callback(50, f"正在插入 {len(welding_data)} 条数据...")
            insert_result = self._insert_welding_data_to_vfactdb(
                db, 
                welding_data, 
                activity_cache=activity_cache,
                progress_callback=progress_callback
            )
            inserted_count = insert_result.get('inserted_count', 0)
            unmatched_drawings = insert_result.get('unmatched_drawings', [])
            
            # 合并无法匹配Activity的图纸到unprocessed_drawings
            unprocessed_drawings.extend(unmatched_drawings)
            
            if progress_callback:
                progress_callback(98, "正在提交事务...")
            db.commit()
            
            # 4. 计算VFACTDB统计（同步完成后）
            if progress_callback:
                progress_callback(99, "正在计算VFACTDB统计...")
            from app.models.report import VFACTDB
            from sqlalchemy import func
            vfactdb_achieved_sum = db.query(func.coalesce(func.sum(VFACTDB.achieved), 0)).filter(
                VFACTDB.work_package.in_(['PI04', 'PI05'])
            ).scalar() or 0.0
            
            logger.info(f"VFACTDB统计计算完成: {vfactdb_achieved_sum:,.2f} DIN")
            
            # 合并删除受影响的 ID 和新增/更新受影响的 ID
            affected_ids = set(insert_result.get('affected_activity_ids', set()))
            affected_ids.update(affected_ids_from_deletion)
            affected_ids_list = list(affected_ids)
            
            logger.info(f"焊接同步完成，收集到 {len(affected_ids_list)} 个受影响的 Activity ID (删除影响: {len(affected_ids_from_deletion)}, 插入影响: {len(insert_result.get('affected_activity_ids', set()))})")
            
            if progress_callback:
                progress_callback(100, f"同步完成：删除 {deleted_count} 条，插入 {inserted_count} 条")
            
            return {
                "success": True,
                "message": f"同步成功（{date_range_str}）：删除 {deleted_count} 条记录，插入 {inserted_count} 条记录",
                "deleted_count": deleted_count,
                "inserted_count": inserted_count,
                "affected_activity_ids": affected_ids_list,
                "date_range": date_range_str,
                "unprocessed_drawings": unprocessed_drawings,  # 无法处理的图纸列表
                "statistics": {
                    "welding_list_total": read_statistics.get('welding_list_total', 0.0),
                    "welding_list_completed": read_statistics.get('welding_list_completed', 0.0),
                    "vfactdb_matched": float(vfactdb_achieved_sum)
                }
            }
        except Exception as e:
            db.rollback()
            logger.error(f"同步PI04/PI05数据失败: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"同步失败: {str(e)}",
                "deleted_count": 0,
                "inserted_count": 0
            }
        finally:
            SystemTaskService.set_task_lock("welding_sync", False)
            if should_close:
                db.close()
    
    def _read_welding_list_data(
        self, 
        target_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, any]:
        """
        从PRECOMCONTROL数据库读取WeldingList数据并处理
        
        逻辑：
        1. 筛选条件：WeldJoint不包含'CW'或'R'，DrawingNumber的Marka在marka_codes中，WeldDate不为空
        2. 按WeldDate、Block、Marka、Scope分组
        3. JointTypeFS='S'→PI04, 'F'→PI05
        4. 计算sum(Size)作为achieved
        
        Args:
            target_date: 如果指定，只处理该日期的数据（单天模式）
            start_date: 开始日期（日期范围模式）
            end_date: 结束日期（日期范围模式）
            如果都不指定，处理所有数据（全部时间段模式）
        """
        from app.database_precomcontrol import PrecomcontrolSessionLocal
        precomcontrol_db = PrecomcontrolSessionLocal()
        
        try:
            # 构建查询
            query_str = """
                SELECT 
                    DrawingNumber,
                    Block,
                    ConstContractor,
                    WeldJoint,
                    JointTypeFS,
                    WeldDate,
                    Size
                FROM WeldingList
                WHERE WeldDate IS NOT NULL
                AND WeldJoint IS NOT NULL
                AND WeldJoint NOT LIKE '%CW%'
                AND WeldJoint NOT LIKE '%R%'
                AND JointTypeFS IN ('S', 'F')
                AND (IsDeleted IS NULL OR IsDeleted = 0)
            """
            
            params = {}
            if target_date:
                # 单天模式
                query_str += " AND DATE(WeldDate) = :target_date"
                params['target_date'] = target_date
            elif start_date and end_date:
                # 日期范围模式
                query_str += " AND DATE(WeldDate) >= :start_date AND DATE(WeldDate) <= :end_date"
                params['start_date'] = start_date
                params['end_date'] = end_date
            # 否则是全部时间段模式，不添加日期条件
            
            # 先查询所有数据用于统计（包括没有WeldDate的，用于计算总量）
            total_query_str = """
                SELECT Size, WeldDate, WeldJoint, JointTypeFS, IsDeleted
                FROM WeldingList
                WHERE Size IS NOT NULL
                AND (IsDeleted IS NULL OR IsDeleted = 0)
            """
            total_params = {}
            if target_date:
                total_query_str += " AND (WeldDate IS NULL OR DATE(WeldDate) = :target_date)"
                total_params['target_date'] = target_date
            elif start_date and end_date:
                total_query_str += " AND (WeldDate IS NULL OR (DATE(WeldDate) >= :start_date AND DATE(WeldDate) <= :end_date))"
                total_params['start_date'] = start_date
                total_params['end_date'] = end_date
            
            total_result = precomcontrol_db.execute(text(total_query_str), total_params)
            all_rows = total_result.fetchall()
            
            query = text(query_str)
            
            result = precomcontrol_db.execute(query, params)
            rows = result.fetchall()
            
            logger.info(f"从WeldingList原始查询得到 {len(rows)} 条记录")
            if progress_callback:
                progress_callback(15, f"已读取 {len(rows):,} 条原始记录，开始处理...")
            
            # 转换为字典列表并处理
            processed_data = []
            skipped_marka = 0
            skipped_block = 0
            skipped_marka_extract = 0
            skipped_scope = 0
            skipped_non_standard = 0
            # 收集无法处理的图纸（用于前端显示）
            unprocessed_drawings = []  # [{drawing_number, constcontractor, reason}]
            # 诊断：统计提取到的Marka（排除VK/NVK/OVK/NV*/NK*）
            extracted_markas = {}  # {marka: count}
            for row in rows:
                drawing_number = row[0] if row[0] else ''
                block = row[1] if row[1] else ''
                constcontractor = row[2] if row[2] else ''
                weld_joint = row[3] if row[3] else ''
                joint_type_fs = row[4] if row[4] else ''
                weld_date = row[5]
                size = row[6] if row[6] else 0
                
                # 检查是否是非标准图纸
                # 重要：先检查WeldingList中当前记录的JointTypeFS，然后检查非标准图纸库中是否有对应的记录
                # 如果WeldingList中只有F口，但非标准图纸库中只有S口的记录，则不应该使用非标准图纸库
                if drawing_number in self.non_standard_drawings:
                    # 获取WeldingList中当前记录的JointTypeFS（实际存在的）
                    actual_joint_type_fs = joint_type_fs  # 从WeldingList读取的实际值
                    
                    # 检查非标准图纸库中是否有对应这个JointTypeFS的记录
                    # 非标准图纸库可能有多条记录（同一个drawing_number可能有S和F两种）
                    # 使用 (drawing_number, joint_type_fs) 作为key直接查找
                    matching_non_standard = self.non_standard_drawings_map.get((drawing_number, actual_joint_type_fs))
                    
                    if matching_non_standard:
                        # 找到匹配的非标准图纸记录，使用其activity_id
                        joint_type_fs = matching_non_standard['joint_type_fs']
                        activity_id = matching_non_standard['activity_id']
                        
                        # ConstContractor映射到Scope
                        scope = self.constcontractor_mapping.get(constcontractor, constcontractor)
                        if not scope:
                            skipped_scope += 1
                            continue
                        
                        # 确定work_package
                        work_package = 'PI04' if joint_type_fs == 'S' else 'PI05'
                        
                        # 转换WeldDate为date对象
                        if isinstance(weld_date, datetime):
                            weld_date_obj = weld_date.date()
                        elif isinstance(weld_date, date):
                            weld_date_obj = weld_date
                        else:
                            try:
                                if isinstance(weld_date, str):
                                    from datetime import datetime as dt
                                    weld_date_obj = dt.strptime(weld_date, '%Y-%m-%d').date()
                                else:
                                    continue
                            except:
                                continue
                        
                        # 转换为数值
                        try:
                            size_value = float(size) if size else 0.0
                        except:
                            size_value = 0.0
                        
                        # 非标准图纸直接使用activity_id，不需要匹配
                        processed_data.append({
                            'weld_date': weld_date_obj,
                            'block': block or '',  # 非标准图纸可能没有标准block格式
                            'marka': None,  # 非标准图纸没有Marka
                            'scope': scope,
                            'work_package': work_package,
                            'size': size_value,
                            'drawing_number': drawing_number,
                            'constcontractor': constcontractor,
                            'activity_id': activity_id,  # 直接使用非标准图纸库中的activity_id
                            'is_non_standard': True
                        })
                        continue
                    else:
                        # 非标准图纸库中没有对应这个JointTypeFS的记录
                        # 可能是：1) 非标准图纸库中只有S口记录，但WeldingList中只有F口数据
                        #         2) 非标准图纸库中只有F口记录，但WeldingList中只有S口数据
                        # 这种情况下，应该跳过非标准图纸处理，按标准图纸处理
                        logger.debug(f"非标准图纸 {drawing_number} 的JointTypeFS={actual_joint_type_fs} 在非标准图纸库中不存在，按标准图纸处理")
                        # 继续执行标准图纸的处理逻辑（不continue，让代码继续往下走）
                
                # 标准图纸：提取Marka用于诊断和筛选
                marka = self._extract_marka_from_drawing(drawing_number)
                if marka:
                    # _extract_marka_from_drawing已经排除了VK/NVK/OVK/NV*/NK*，这里直接使用
                    extracted_markas[marka] = extracted_markas.get(marka, 0) + 1
                    # 检查Marka是否在配置表中
                    if marka not in self.marka_codes:
                        skipped_marka += 1
                        # 记录无法处理的图纸（Marka不在配置表中）
                        unprocessed_drawings.append({
                            'drawing_number': drawing_number,
                            'constcontractor': constcontractor,
                            'reason': f'Marka "{marka}" 不在配置表中'
                        })
                        continue
                else:
                    # 无法提取Marka，跳过（可能是非标准图纸但未在库中，或VK/NVK/OVK/NV*/NK*）
                    skipped_marka += 1
                    # 检查是否是VK/NVK/OVK/NV*/NK*的情况（应该静默跳过，不记录）
                    # 尝试提取Marka来判断（即使_extract_marka_from_drawing返回None，我们也需要检查是否是NVK等）
                    pattern = r'\d{5}-\d{2}-\d{4}-([A-Z]{2,4})'
                    match = re.search(pattern, drawing_number)
                    if match:
                        potential_marka = match.group(1).upper()
                        # 如果是VK/NVK/OVK/NV*/NK*开头，静默跳过，不记录
                        if potential_marka.startswith(('VK', 'NVK', 'OVK')) or potential_marka.startswith('NV') or potential_marka.startswith('NK'):
                            continue  # 静默跳过，不记录到unprocessed_drawings
                    
                    # 只记录非标准图纸但未在库中的情况（排除VK/NVK/OVK/NV*/NK*）
                    unprocessed_drawings.append({
                        'drawing_number': drawing_number,
                        'constcontractor': constcontractor,
                        'reason': '无法提取Marka（可能是非标准图纸但未在非标准图纸库中）'
                    })
                    continue
                
                # 提取Block（如果block字段格式不正确，从DrawingNumber提取）
                extracted_block = self._extract_block_from_drawing(drawing_number, block)
                if not extracted_block:
                    skipped_block += 1
                    # 记录无法处理的图纸（无法提取Block）
                    unprocessed_drawings.append({
                        'drawing_number': drawing_number,
                        'constcontractor': constcontractor,
                        'reason': '无法提取Block'
                    })
                    continue
                
                # Marka已经在上面提取过了，这里只需要检查
                if not marka:
                    skipped_marka_extract += 1
                    continue
                
                # ConstContractor映射到Scope
                scope = self.constcontractor_mapping.get(constcontractor, constcontractor)
                if not scope:
                    skipped_scope += 1
                    continue
                
                # 确定work_package
                work_package = 'PI04' if joint_type_fs == 'S' else 'PI05'
                
                # 转换WeldDate为date对象
                if isinstance(weld_date, datetime):
                    weld_date_obj = weld_date.date()
                elif isinstance(weld_date, date):
                    weld_date_obj = weld_date
                else:
                    try:
                        # 尝试解析字符串日期
                        if isinstance(weld_date, str):
                            from datetime import datetime as dt
                            weld_date_obj = dt.strptime(weld_date, '%Y-%m-%d').date()
                        else:
                            continue
                    except:
                        continue
                
                # 转换为数值
                try:
                    size_value = float(size) if size else 0.0
                except:
                    size_value = 0.0
                
                processed_data.append({
                    'weld_date': weld_date_obj,
                    'block': extracted_block,
                    'marka': marka,
                    'scope': scope,
                    'work_package': work_package,
                    'size': size_value,
                    'drawing_number': drawing_number,
                    'constcontractor': constcontractor,
                    'is_non_standard': False
                })
            
            # 按日期、block、marka、scope、work_package分组，sum(size)
            # 非标准图纸需要按activity_id分组（因为直接有activity_id）
            grouped_data = {}
            for item in processed_data:
                if item.get('is_non_standard') and item.get('activity_id'):
                    # 非标准图纸：按日期、activity_id、scope、work_package分组
                    key = (
                        item['weld_date'],
                        item['activity_id'],
                        item['scope'],
                        item['work_package']
                    )
                    if key not in grouped_data:
                        grouped_data[key] = {
                            'weld_date': item['weld_date'],
                            'block': item['block'],
                            'marka': item['marka'],
                            'scope': item['scope'],
                            'work_package': item['work_package'],
                            'achieved': 0.0,
                            'activity_id': item['activity_id'],
                            'is_non_standard': True,
                            'drawing_number': item.get('drawing_number', ''),  # 保存第一个图纸编号
                            'constcontractor': item.get('constcontractor', '')  # 保存第一个施工分包商
                        }
                    grouped_data[key]['achieved'] += item['size']
                    # 如果当前图纸编号不同，可以追加（可选，这里只保存第一个）
                else:
                    # 标准图纸：按日期、block、marka、scope、work_package分组
                    key = (
                        item['weld_date'],
                        item['block'],
                        item['marka'],
                        item['scope'],
                        item['work_package']
                    )
                    if key not in grouped_data:
                        grouped_data[key] = {
                            'weld_date': item['weld_date'],
                            'block': item['block'],
                            'marka': item['marka'],
                            'scope': item['scope'],
                            'work_package': item['work_package'],
                            'achieved': 0.0,
                            'is_non_standard': False,
                            'drawing_number': item.get('drawing_number', ''),  # 保存第一个图纸编号
                            'constcontractor': item.get('constcontractor', '')  # 保存第一个施工分包商
                        }
                    grouped_data[key]['achieved'] += item['size']
                    # 如果当前图纸编号不同，可以追加（可选，这里只保存第一个）
            
            # 转换为列表
            welding_data = list(grouped_data.values())
            if progress_callback:
                progress_callback(25, f"数据处理完成：{len(welding_data):,} 条分组数据")
            logger.info(f"从WeldingList处理统计:")
            logger.info(f"  - 原始记录数: {len(rows):,}")
            logger.info(f"  - Marka筛选跳过: {skipped_marka:,}")
            logger.info(f"  - Block提取失败跳过: {skipped_block:,}")
            logger.info(f"  - Marka提取失败跳过: {skipped_marka_extract:,}")
            logger.info(f"  - Scope为空跳过: {skipped_scope:,}")
            logger.info(f"  - 处理后的记录数: {len(processed_data):,}")
            logger.info(f"  - 分组后的记录数: {len(welding_data):,}")
            logger.info(f"  - 无法处理的图纸数量: {len(unprocessed_drawings):,}")
            
            # 统计非标准图纸数量
            non_standard_count = len([x for x in processed_data if x.get('is_non_standard')])
            standard_count = len(processed_data) - non_standard_count
            
            # 诊断：统计Marka分布（已排除VK/NVK/OVK/NV*/NK*）
            valid_markas = {m: c for m, c in extracted_markas.items() 
                          if not (m.startswith(('VK', 'NVK', 'OVK')) or m.startswith('NV') or m.startswith('NK'))}
            marka_in_config = {m for m in valid_markas.keys() if m in self.marka_codes}
            marka_not_in_config = {m for m in valid_markas.keys() if m not in self.marka_codes}
            
            # 打印到控制台（用于测试脚本）
            print(f"\n  详细统计:")
            print(f"    - 原始记录数: {len(rows):,}")
            print(f"    - Marka筛选跳过: {skipped_marka:,} ({skipped_marka/len(rows)*100:.1f}%)")
            print(f"    - Block提取失败跳过: {skipped_block:,} ({skipped_block/len(rows)*100:.1f}%)")
            print(f"    - Marka提取失败跳过: {skipped_marka_extract:,} ({skipped_marka_extract/len(rows)*100:.1f}%)")
            print(f"    - Scope为空跳过: {skipped_scope:,} ({skipped_scope/len(rows)*100:.1f}%)")
            print(f"    - 非标准图纸处理: {non_standard_count:,} 条")
            print(f"    - 标准图纸处理: {standard_count:,} 条")
            print(f"    - 处理后的记录数: {len(processed_data):,}")
            print(f"    - 分组后的记录数: {len(welding_data):,}")
            print(f"    - 无法处理的图纸数量: {len(unprocessed_drawings):,}")
            print(f"\n  Marka诊断（已排除VK/NVK/OVK/NV*/NK*）:")
            print(f"    - 提取到的唯一Marka数量: {len(valid_markas)}")
            print(f"    - 在配置表中的Marka: {len(marka_in_config)} 个")
            print(f"    - 不在配置表中的Marka: {len(marka_not_in_config)} 个")
            if marka_in_config:
                print(f"    - 在配置表中的Marka（前10个）: {sorted(list(marka_in_config))[:10]}")
            if marka_not_in_config:
                print(f"    - 不在配置表中的Marka（前20个，按数量排序）:")
                sorted_not_in_config = sorted([(m, valid_markas[m]) for m in marka_not_in_config], key=lambda x: x[1], reverse=True)[:20]
                for marka, count in sorted_not_in_config:
                    print(f"        {marka}: {count:,} 条记录")
            
            # 处理无法处理的图纸列表：去除末尾页码，去重
            def normalize_drawing_number(drawing_number: str) -> str:
                """
                标准化图纸编号：去除末尾的页码部分
                例如: GCC-AFT-DDD-13220-04-5200-NVK-PLN-00001 -> GCC-AFT-DDD-13220-04-5200-NVK-PLN
                """
                if not drawing_number:
                    return drawing_number
                # 匹配末尾的页码模式：-数字（通常是-00001, -00002等）
                # 去除最后一段如果是纯数字
                parts = drawing_number.split('-')
                if len(parts) > 0 and parts[-1].isdigit():
                    # 去除最后一段数字
                    return '-'.join(parts[:-1])
                return drawing_number
            
            # 标准化并去重无法处理的图纸列表
            normalized_unprocessed = {}
            for item in unprocessed_drawings:
                normalized_number = normalize_drawing_number(item['drawing_number'])
                # 使用标准化后的图纸编号作为key，保留第一个出现的记录
                if normalized_number not in normalized_unprocessed:
                    normalized_unprocessed[normalized_number] = {
                        'drawing_number': normalized_number,
                        'constcontractor': item['constcontractor'],
                        'reason': item['reason']
                    }
            
            # 计算统计信息：诺德录入总量和完成量
            # 总量：所有Size不为NULL的记录（从all_rows计算）
            total_size_sum = sum(
                float(row.Size or 0) 
                for row in all_rows 
                if row.Size is not None
            )
            
            # 完成量：有WeldDate且Size不为NULL的记录（使用与同步相同的过滤条件，从rows计算）
            completed_size_sum = sum(
                float(row.Size or 0) 
                for row in rows 
                if row.Size is not None
            )
            
            logger.info(f"统计计算完成:")
            logger.info(f"  - 诺德录入总量: {total_size_sum:,.2f} DIN")
            logger.info(f"  - 完成量（有日期的Size）: {completed_size_sum:,.2f} DIN")
            
            # 返回字典，包含welding_data、unprocessed_drawings和统计信息
            return {
                'welding_data': welding_data,
                'unprocessed_drawings': list(normalized_unprocessed.values()),
                'statistics': {
                    'welding_list_total': float(total_size_sum),
                    'welding_list_completed': float(completed_size_sum)
                }
            }
            
        except Exception as e:
            logger.error(f"读取WeldingList数据失败: {e}", exc_info=True)
            return {
                'welding_data': [],
                'unprocessed_drawings': []
            }
        finally:
            precomcontrol_db.close()
    
    def _delete_existing_pi04_pi05(
        self, 
        db: Session, 
        target_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Tuple[int, Set[str]]:
        """
        分批删除现有的PI04和PI05数据，减小事务持锁范围，避免死锁
        
        Returns:
            (deleted_count, affected_activity_ids)
        """
        try:
            # 1. 构造查询条件
            base_query = db.query(VFACTDB).filter(
                VFACTDB.work_package.in_(['PI04', 'PI05']),
                VFACTDB.is_system_sync == True  # 只删除系统同步的记录
            )
            
            if target_date:
                base_query = base_query.filter(VFACTDB.date == target_date)
            elif start_date and end_date:
                base_query = base_query.filter(VFACTDB.date >= start_date, VFACTDB.date <= end_date)
            
            # 2. 先获取所有受影响的 activity_id 和记录 ID（分两步，避免一次性加载过多 ID）
            logger.info("正在查询待删除记录的 Activity ID...")
            affected_activity_ids = {row[0] for row in base_query.with_entities(VFACTDB.activity_id).all() if row[0]}
            
            logger.info("正在查询待删除记录的主键 ID...")
            all_ids = [row[0] for row in base_query.with_entities(VFACTDB.id).all()]
            total_to_delete = len(all_ids)
            
            if total_to_delete == 0:
                return 0, set()
                
            # 3. 分批删除
            batch_size = 500
            deleted_count = 0
            logger.info(f"开始分批删除 {total_to_delete} 条记录，每批 {batch_size} 条...")
            
            for i in range(0, total_to_delete, batch_size):
                batch_ids = all_ids[i:i + batch_size]
                try:
                    # 使用 IN 子句批量删除
                    result = db.query(VFACTDB).filter(VFACTDB.id.in_(batch_ids)).delete(synchronize_session=False)
                    db.commit() # 关键：每批提交一次，释放行锁
                    deleted_count += result
                    
                    if (deleted_count % 2000 == 0) or (i + batch_size >= total_to_delete):
                        logger.info(f"已删除 {deleted_count}/{total_to_delete} 条记录...")
                except Exception as batch_error:
                    db.rollback()
                    logger.error(f"分批删除失败 (batch {i}-{i+len(batch_ids)}): {batch_error}")
                    raise
            
            logger.info(f"实际删除了 {deleted_count} 条PI04/PI05数据，涉及 {len(affected_activity_ids)} 个作业")
            return deleted_count, affected_activity_ids
        except Exception as e:
            logger.error(f"分批删除PI04/PI05数据失败: {e}", exc_info=True)
            raise
    
    def _match_activity_by_title(self, db: Session, block: str, marka: str, scope: str, work_package: str) -> Optional[ActivitySummary]:
        """
        通过activity_summary.title匹配activity_id
        
        title格式: "... (block-??-marka)" 或 "... block-??-marka"
        例如: "Storage System...:Piping Shop Prefabrication(1100-12401-41-PI-TKM)"
        中间部分不一定是PI，可能是任意内容
        
        匹配模式：block-%-marka（中间可以是任意内容）
        精准匹配：确保marka后面不是字母或数字，避免 TKM 匹配到 TKM1
        """
        from sqlalchemy import and_
        
        # 构建SQL LIKE模式：block-%-marka 做初步筛选
        pattern = f"%{block}-%-{marka}%"
        
        try:
            # 1. 先通过SQL LIKE初步筛选符合条件的活动
            activities = db.query(ActivitySummary).filter(
                and_(
                    ActivitySummary.work_package == work_package,
                    ActivitySummary.scope == scope,
                    ActivitySummary.title.like(pattern)
                )
            ).execution_options(timeout=10).all()
            
            if not activities:
                return None
            
            # 2. 在Python中进行精准匹配，避免前缀匹配问题（如 TKM 匹配 TKM1）
            # 使用正则表达式确保 marka 后面没有字母或数字
            # 匹配模式：block 后面跟着 -，中间任意字符，最后是 marka 且后面无字母数字
            regex_pattern = rf"{re.escape(block)}-.*?-{re.escape(marka)}(?![A-Za-z0-9])"
            
            for activity in activities:
                if re.search(regex_pattern, activity.title):
                    return activity
            
            # 如果正则表达式匹配失败，返回第一个（保持一定的兼容性，虽然可能不准确）
            # 但理想情况下应该返回 None 或者最匹配的一个
            return None
            
        except Exception as e:
            logger.warning(f"查询Activity时出错 (block={block}, marka={marka}, scope={scope}, work_package={work_package}): {e}")
            return None
    
    def _is_deadlock_error(self, error: Exception) -> bool:
        """检查是否是死锁错误"""
        if isinstance(error, OperationalError):
            error_code = error.orig.args[0] if hasattr(error.orig, 'args') and error.orig.args else None
            if error_code == 1213:  # MySQL deadlock error code
                return True
        # 检查是否是 pymysql 的死锁错误
        if isinstance(error, pymysql.err.OperationalError):
            if error.args[0] == 1213:
                return True
        return False
    
    def _insert_batch_with_retry(
        self,
        db: Session,
        batch: List[Dict],
        activity_cache: Optional[Dict],
        activity_match_cache: Dict,
        work_step_description_map: Dict,
        batch_idx: int,
        max_retries: int = 3
    ) -> Dict[str, any]:
        """
        插入一批数据，带死锁重试机制
        
        Args:
            db: 数据库会话
            batch: 要插入的数据批次
            activity_cache: Activity缓存
            activity_match_cache: Activity匹配缓存
            work_step_description_map: work_step_description映射
            batch_idx: 批次索引
            max_retries: 最大重试次数
        
        Returns:
            {
                'inserted_count': int,
                'skipped_count': int,
                'unmatched_drawings': List[Dict],
                'affected_activity_ids': set
            }
        """
        inserted_count = 0
        skipped_count = 0
        unmatched_drawings = []
        affected_activity_ids = set()
        
        for retry in range(max_retries):
            try:
                # 准备要插入的记录
                entries_to_insert = []
                batch_unmatched = []
                activity_map = {}  # {(date, activity_id): activity} 用于匹配
                
                # 第一步：处理所有数据，匹配activity
                for welding_item in batch:
                    try:
                        block = welding_item.get('block')
                        marka = welding_item.get('marka')
                        scope = welding_item.get('scope')
                        work_package = welding_item.get('work_package')
                        achieved = welding_item.get('achieved', 0)
                        weld_date = welding_item.get('weld_date')
                        if not weld_date:
                            continue
                        
                        # 检查是否是非标准图纸（直接有activity_id）
                        if welding_item.get('is_non_standard') and welding_item.get('activity_id'):
                            # 非标准图纸：直接使用activity_id，从缓存中获取（性能优化）
                            activity_id = str(welding_item['activity_id']).strip()
                            # 优先从缓存中获取
                            if activity_cache:
                                activity = activity_cache.get(activity_id)
                            else:
                                # 如果没有缓存，从数据库查询
                                activity = db.query(ActivitySummary).filter(
                                    ActivitySummary.activity_id == activity_id
                                ).first()
                            
                            if not activity:
                                # 如果缓存中没有，尝试从数据库查询（可能是新数据）
                                activity = db.query(ActivitySummary).filter(
                                    ActivitySummary.activity_id == activity_id
                                ).first()
                                if activity and activity_cache is not None:
                                    # 添加到缓存
                                    activity_cache[activity_id] = activity
                            
                            if not activity:
                                skipped_count += 1
                                # 记录到unmatched_drawings
                                batch_unmatched.append({
                                    'drawing_number': welding_item.get('drawing_number', ''),
                                    'constcontractor': welding_item.get('constcontractor', ''),
                                    'reason': f'非标准图纸的activity_id不存在: {activity_id}'
                                })
                                continue
                        else:
                            # 标准图纸：通过title匹配activity_id
                            if not all([block, marka, scope, work_package]):
                                logger.warning(f"数据不完整，跳过: {welding_item}")
                                skipped_count += 1
                                continue
                            
                            # 通过title匹配activity_id（优先使用缓存，性能优化）
                            cache_key = (block, marka, scope, work_package)
                            activity = activity_match_cache.get(cache_key) if activity_match_cache else None
                            
                            if not activity:
                                # 缓存未命中，使用SQL查询
                                activity = self._match_activity_by_title(db, block, marka, scope, work_package)
                                if activity and activity_match_cache is not None:
                                    # 添加到缓存
                                    activity_match_cache[cache_key] = activity
                            
                            if not activity:
                                skipped_count += 1
                                # 记录无法匹配Activity的图纸
                                batch_unmatched.append({
                                    'drawing_number': welding_item.get('drawing_number', ''),
                                    'constcontractor': welding_item.get('constcontractor', ''),
                                    'reason': f'无法匹配Activity (block={block}, marka={marka}, scope={scope}, work_package={work_package})'
                                })
                                continue
                        
                        # 保存activity信息，用于后续批量查询
                        key = (weld_date, activity.activity_id)
                        activity_map[key] = {
                            'activity': activity,
                            'achieved': Decimal(str(achieved)),
                            'welding_item': welding_item,
                            'work_package': work_package
                        }
                        
                    except Exception as e:
                        logger.error(f"准备VFACTDB记录失败: {e}, 数据: {welding_item}", exc_info=True)
                        skipped_count += 1
                        continue
                
                # 第二步：批量查询已存在的记录（减少数据库查询次数）
                # 优化：分批查询，避免一次性查询过多数据导致超时
                existing_records = {}
                if activity_map:
                    # 构建查询条件
                    date_activity_pairs = list(activity_map.keys())
                    if date_activity_pairs:
                        # 分批查询，每批最多100个组合，避免查询过大导致超时
                        batch_query_size = 100
                        for i in range(0, len(date_activity_pairs), batch_query_size):
                            batch_pairs = date_activity_pairs[i:i+batch_query_size]
                            dates = [pair[0] for pair in batch_pairs]
                            activity_ids = [pair[1] for pair in batch_pairs]
                            
                            try:
                                # 设置查询超时（30秒）
                                existing = db.query(VFACTDB).filter(
                                    VFACTDB.date.in_(dates),
                                    VFACTDB.activity_id.in_(activity_ids),
                                    VFACTDB.is_system_sync == True
                                ).execution_options(timeout=30).all()
                                
                                for record in existing:
                                    key = (record.date, record.activity_id)
                                    existing_records[key] = record
                            except Exception as query_error:
                                logger.warning(f"批次 {batch_idx} 查询已存在记录时出错（跳过本批次查询，继续处理）: {query_error}")
                                # 如果查询失败，继续处理下一批，existing_records为空，所有记录都会作为新记录插入
                                # 不break，继续处理剩余的批次
                                continue
                
                # 第三步：准备插入或更新
                for key, data in activity_map.items():
                    weld_date, activity_id = key
                    activity = data['activity']
                    achieved = data['achieved']
                    work_package = data['work_package']
                    
                    affected_activity_ids.add(activity_id)
                    
                    if key in existing_records:
                        # 如果已存在系统同步的记录，更新它
                        existing = existing_records[key]
                        existing.achieved = achieved
                        existing.updated_at = system_now()
                        existing.update_method = "welding_sync"
                        # SQLAlchemy会自动跟踪更改，无需额外处理
                        inserted_count += 1
                    else:
                        # 创建新记录
                        vfactdb_entry = VFACTDB(
                            date=weld_date,
                            activity_id=activity_id,
                            scope=activity.scope or '',
                            project=activity.project or '',
                            subproject=activity.subproject or '',
                            implement_phase=activity.implement_phase or '',
                            train=activity.train or '',
                            unit=activity.unit or '',
                            block=activity.block or '',
                            quarter=activity.quarter or '',
                            main_block=activity.main_block or '',
                            title=activity.title or '',
                            work_step_description=work_step_description_map.get(work_package, ''),
                            discipline=activity.discipline or '',
                            work_package=work_package,
                            achieved=achieved,
                            is_system_sync=True,
                            update_method="welding_sync"
                        )
                        entries_to_insert.append(vfactdb_entry)
                
                # 批量插入和更新
                if entries_to_insert:
                    for entry in entries_to_insert:
                        db.add(entry)
                
                # 提交事务（设置超时）
                try:
                    db.commit()
                except Exception as commit_error:
                    # 如果提交失败，记录错误并回滚
                    logger.error(f"批次 {batch_idx} 提交事务失败: {commit_error}", exc_info=True)
                    db.rollback()
                    raise  # 重新抛出异常，触发重试机制
                
                # 成功插入
                inserted_count += len(entries_to_insert)
                unmatched_drawings.extend(batch_unmatched)
                
                # 如果成功，退出重试循环
                break
                
            except Exception as e:
                # 回滚事务，释放连接
                try:
                    db.rollback()
                except Exception as rollback_error:
                    logger.error(f"回滚事务失败: {rollback_error}", exc_info=True)
                
                # 检查是否是死锁错误
                if self._is_deadlock_error(e) and retry < max_retries - 1:
                    # 计算退避时间（指数退避）
                    wait_time = (2 ** retry) * 0.1  # 0.1s, 0.2s, 0.4s
                    logger.warning(
                        f"批次 {batch_idx} 发生死锁，第 {retry + 1}/{max_retries} 次重试，等待 {wait_time:.2f} 秒后重试: {e}"
                    )
                    # 在重试前短暂释放连接，让其他请求有机会使用
                    try:
                        db.expire_all()  # 清除所有对象的会话状态
                    except Exception:
                        pass
                    time.sleep(wait_time)
                    continue
                else:
                    # 不是死锁错误，或者已达到最大重试次数
                    logger.error(f"批次 {batch_idx} 插入失败: {e}", exc_info=True)
                    # 将本批次的所有记录标记为跳过
                    skipped_count += len(batch)
                    unmatched_drawings.extend(batch_unmatched)
                    # 对于无法插入的记录，也添加到unmatched_drawings
                    for welding_item in batch:
                        unmatched_drawings.append({
                            'drawing_number': welding_item.get('drawing_number', ''),
                            'constcontractor': welding_item.get('constcontractor', ''),
                            'reason': f'插入失败: {str(e)}'
                        })
                    break
        
        return {
            'inserted_count': inserted_count,
            'skipped_count': skipped_count,
            'unmatched_drawings': unmatched_drawings,
            'affected_activity_ids': affected_activity_ids
        }
    
    def _insert_welding_data_to_vfactdb(
        self,
        db: Session,
        welding_data: List[Dict],
        activity_cache: Optional[Dict] = None,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, any]:
        """
        将WeldingList数据转换为VFACTDB格式并插入
        
        通过activity_summary.title匹配activity_id（格式：block-??-marka）
        优化：批量处理，减少数据库查询次数
        
        Returns:
            {
                'inserted_count': int,
                'unmatched_drawings': List[Dict]  # 无法匹配Activity的图纸
            }
        """
        inserted_count = 0
        skipped_count = 0
        unmatched_drawings = []  # 收集无法匹配Activity的图纸
        affected_activity_ids = set()  # 收集受影响的activity_id
        
        # 预加载PI04/PI05的is_key_quantity=True对应的work_step_description
        # 用于写入VFACTDB时设置work_step_description字段
        work_step_description_map = {}  # {work_package: work_step_description}
        if progress_callback:
            progress_callback(50, "正在加载PI04/PI05的work_step_description...")
        key_workstep_defines = db.query(WorkStepDefine).filter(
            WorkStepDefine.work_package.in_(['PI04', 'PI05']),
            WorkStepDefine.is_active == True,
            WorkStepDefine.is_key_quantity == True
        ).all()
        for workstep in key_workstep_defines:
            # 如果同一个work_package有多个is_key_quantity=True的记录，使用第一个
            if workstep.work_package not in work_step_description_map:
                work_step_description_map[workstep.work_package] = workstep.work_step_description
        logger.info(f"加载了PI04/PI05的work_step_description: {work_step_description_map}")
        
        # 预加载Activity匹配缓存（性能优化）
        # 构建 block-marka-scope-work_package -> activity 的映射字典
        activity_match_cache = {}  # {(block, marka, scope, work_package): ActivitySummary}
        if activity_cache:
            # 从缓存中构建匹配字典
            if progress_callback:
                progress_callback(51, "正在构建Activity匹配缓存...")
            
            # 准备Marka正则表达式，确保精准匹配
            if self.marka_codes:
                # 按长度降序排序，确保匹配最长的Marka（如 TKM1 优先于 TKM）
                sorted_markas = sorted(list(self.marka_codes), key=len, reverse=True)
                markas_pattern = '|'.join(re.escape(m) for m in sorted_markas)
            else:
                # 回退到硬编码的列表
                markas_pattern = 'TKM|TK|TH|PT|TM|TS'
            
            # 匹配模式：(block-anything-marka) 且 marka 后面不能是字母或数字
            # 格式例如: (1100-12401-50-PI-TKM)
            regex_pattern = rf'(\d{{4}}-\d{{5}}-\d{{2}})-.*?-({markas_pattern})(?![A-Za-z0-9])'
            
            for activity in activity_cache.values():
                if activity.work_package in ['PI04', 'PI05'] and activity.title:
                    title = activity.title
                    match = re.search(regex_pattern, title)
                    if match:
                        block = match.group(1)
                        marka = match.group(2)
                        key = (block, marka, activity.scope, activity.work_package)
                        if key not in activity_match_cache:
                            activity_match_cache[key] = activity
            if progress_callback:
                progress_callback(52, f"已构建 {len(activity_match_cache)} 个匹配缓存")
        
        # 批量处理，每50条提交一次，减小事务范围以避免死锁
        batch_size = 50
        total_batches = (len(welding_data) + batch_size - 1) // batch_size
        for batch_idx, i in enumerate(range(0, len(welding_data), batch_size)):
            batch = welding_data[i:i+batch_size]
            
            if progress_callback:
                progress = 52 + int((batch_idx + 1) / total_batches * 45)
                progress_callback(progress, f"正在处理第 {batch_idx + 1}/{total_batches} 批数据 ({len(batch)} 条)...")
            
            # 使用死锁重试机制处理每批数据
            batch_inserted = self._insert_batch_with_retry(
                db=db,
                batch=batch,
                activity_cache=activity_cache,
                activity_match_cache=activity_match_cache,
                work_step_description_map=work_step_description_map,
                batch_idx=batch_idx
            )
            
            inserted_count += batch_inserted['inserted_count']
            skipped_count += batch_inserted['skipped_count']
            unmatched_drawings.extend(batch_inserted['unmatched_drawings'])
            affected_activity_ids.update(batch_inserted['affected_activity_ids'])
            
            # 每处理10个批次后，刷新会话并短暂释放连接，避免连接池耗尽
            if (batch_idx + 1) % 10 == 0:
                try:
                    # 增加心跳：更新任务锁时间戳，防止被视为僵尸任务
                    from app.services.system_task_service import SystemTaskService
                    SystemTaskService.set_task_lock("welding_sync", True, updated_by="WeldingSyncService", remarks=f"正在处理第 {batch_idx + 1}/{total_batches} 批数据")
                    
                    db.expire_all()  # 清除会话状态
                    # 短暂延迟，让连接池有机会回收连接
                    time.sleep(0.1)
                except Exception as e:
                    logger.warning(f"批次 {batch_idx} 刷新会话或心跳失败: {e}")
        
        logger.info(f"成功插入 {inserted_count} 条VFACTDB记录，跳过 {skipped_count} 条")
        logger.info(f"无法匹配Activity的图纸数量: {len(unmatched_drawings)}")
        if progress_callback:
            progress_callback(97, f"插入完成：{inserted_count} 条成功，{skipped_count} 条跳过")
        return {
            'inserted_count': inserted_count,
            'unmatched_drawings': unmatched_drawings,
            'affected_activity_ids': affected_activity_ids
        }

