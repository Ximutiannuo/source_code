
import pandas as pd
import numpy as np
import os
import sys
import logging
import csv
import tempfile
from datetime import datetime
from sqlalchemy import text

# 添加后端路径
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import default_engine

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def fast_import_pivot_excel(file_path: str, table_name: str, value_column: str, resource_id_default=None, allow_negative=False):
    """
    极速导入方案：Numpy 定位 + CSV 暂存 + LOAD DATA LOCAL INFILE
    allow_negative: 若为 True，则包含负值；否则仅导入正值。
    """
    if not os.path.exists(file_path):
        logger.error(f"文件不存在: {file_path}")
        return

    logger.info(f"\n>>> 极速处理开始: {os.path.basename(file_path)}")
    total_start = datetime.now()

    try:
        # 1. 快速读取 Excel (只读入内存)
        logger.info("Step 1: 正在加载 Excel 到内存...")
        df = pd.read_excel(file_path)
        load_time = datetime.now() - total_start
        logger.info(f"Excel 加载完成，耗时: {load_time}, 行数: {len(df)}")

        # 2. 识别日期列和元数据列
        date_cols = []
        meta_cols = []
        for col in df.columns:
            try:
                pd.to_datetime(col)
                date_cols.append(col)
            except:
                meta_cols.append(col)
        
        # 寻找关键列名
        act_id_col = next((c for c in df.columns if str(c).upper() in ['ACT ID', 'ACTIVITY ID']), None)
        res_id_col = next((c for c in df.columns if 'Resource' in str(c) and 'ID' in str(c)), None)

        # 3. 利用 Numpy 矩阵加速提取非零值
        logger.info(f"Step 2: 正在利用 Numpy 提取非零数据 (处理 {len(df) * len(date_cols)} 个单元格)...")
        data_matrix = df[date_cols].values
        # 替换 NaN 为 0，方便处理
        data_matrix = np.nan_to_num(data_matrix)
        
        # 瞬间定位非零坐标（allow_negative 时包含负值）
        if allow_negative:
            rows, cols = np.where(data_matrix != 0)
        else:
            rows, cols = np.where(data_matrix > 0)
        logger.info(f"定位完成，共找到 {len(rows)} 条有效进度数据。")

        # 4. 生成临时 CSV 文件
        logger.info("Step 3: 正在生成临时同步文件...")
        temp_csv = tempfile.mktemp(suffix='.csv')
        
        # 预先提取 Activity ID 和 Resource ID 列表，加速循环
        act_ids = df[act_id_col].values
        res_ids = df[res_id_col].values if res_id_col else [resource_id_default] * len(df)
        date_objects = [pd.to_datetime(d).strftime('%Y-%m-%d') for d in date_cols]

        with open(temp_csv, 'w', newline='', encoding='utf8') as f:
            writer = csv.writer(f)
            # CSV 结构: activity_id, resource_id, date, value
            for r, c in zip(rows, cols):
                writer.writerow([
                    act_ids[r],
                    res_ids[r] if res_id_col else resource_id_default,
                    date_objects[c],
                    data_matrix[r, c]
                ])

        # 5. MySQL 暴力入库 (LOAD DATA)
        logger.info("Step 4: 正在执行 MySQL LOAD DATA (极速入库)...")
        
        # 准备 SQL 语句
        # 注意：这里需要确保 MySQL 用户有 FILE 权限，或者启用 local_infile
        temp_csv_mysql = temp_csv.replace('\\', '/')
        sql = f"""
        LOAD DATA LOCAL INFILE '{temp_csv_mysql}'
        INTO TABLE {table_name}
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\r\n'
        (activity_id, resource_id, date, {value_column});
        """

        with default_engine.connect() as conn:
            logger.info(f"正在清空表 {table_name}...")
            conn.execute(text(f"TRUNCATE TABLE {table_name}"))
            conn.commit()
            
            logger.info("执行 LOAD DATA...")
            # 获取底层 DBAPI 连接
            raw_conn = conn.connection
            # 确保客户端开启了 local_infile
            # 对于 PyMySQL，通常需要在 connect() 时指定，或者在连接后设置
            with raw_conn.cursor() as cursor:
                # 移除 SET GLOBAL 避免权限错误，假设服务器已开启
                cursor.execute(sql)
            raw_conn.commit()

        logger.info(f"入库成功！累计耗时: {datetime.now() - total_start}")
        
        # 清理
        if os.path.exists(temp_csv):
            os.remove(temp_csv)

    except Exception as e:
        logger.error(f"导入失败: {e}")
        if 'temp_csv' in locals() and os.path.exists(temp_csv):
            os.remove(temp_csv)

def import_weight_factors(file_path: str):
    """
    权重更新逻辑保持不变，因为数据量小且是 UPDATE 操作
    """
    logger.info(f"\n>>> 处理权重文件: {os.path.basename(file_path)}")
    try:
        df = pd.read_excel(file_path)
        act_id_col = next((c for c in df.columns if str(c).upper() in ['ACT ID', 'ACTIVITY ID']), None)
        wf_col = next((c for c in df.columns if 'Weight Factor' in str(c)), None)
        
        if not act_id_col or not wf_col:
            logger.error("缺少列")
            return

        df = df.dropna(subset=[act_id_col, wf_col])
        data = df[[act_id_col, wf_col]].values.tolist()
        
        with default_engine.connect() as conn:
            statement = text("UPDATE activity_summary SET weight_factor = :wf WHERE activity_id = :aid")
            # 批量执行
            batch = [{"wf": row[1], "aid": str(row[0])} for row in data]
            conn.execute(statement, batch)
            conn.commit()
        logger.info(f"权重更新完成: {len(batch)} 行")
    except Exception as e:
        logger.error(f"权重更新失败: {e}")

def main():
    base_path = r"C:\Projects\ProjectControls\original system"
    
    # 1. 权重
    import_weight_factors(os.path.join(base_path, "OWF Weight Factor.xlsx"))
    
    # 2. Budget (极速模式，允许负值)
    fast_import_pivot_excel(
        os.path.join(base_path, "Progress for BI_202411_Budget.xlsx"),
        "budgeted_db",
        "budgeted_units",
        allow_negative=True
    )
    
    # 3. At Completion (极速模式，允许负值)
    fast_import_pivot_excel(
        os.path.join(base_path, "Progress for BI_202411_AtCompletion.xlsx"),
        "atcompletion_db",
        "atcompletion_units",
        allow_negative=True
    )
    
    # 4. OWF Actuals (极速模式，允许负值)
    fast_import_pivot_excel(
        os.path.join(base_path, "Progress for BI_OWF.xlsx"),
        "owf_db",
        "actual_units",
        resource_id_default='GCC_WF',
        allow_negative=True
    )

if __name__ == "__main__":
    base_path = r"C:\Projects\ProjectControls\original system"
    argv = sys.argv
    if any(f in argv for f in ("--weight", "--budgeted_db", "--atcompletion_db", "--owf_db")):
        if "--weight" in argv:
            import_weight_factors(os.path.join(base_path, "OWF Weight Factor.xlsx"))
        if "--budgeted_db" in argv:
            fast_import_pivot_excel(
                os.path.join(base_path, "Progress for BI_202411_Budget.xlsx"),
                "budgeted_db",
                "budgeted_units",
                allow_negative=True
            )
        if "--atcompletion_db" in argv:
            fast_import_pivot_excel(
                os.path.join(base_path, "Progress for BI_202411_AtCompletion.xlsx"),
                "atcompletion_db",
                "atcompletion_units",
                allow_negative=True
            )
        if "--owf_db" in argv:
            fast_import_pivot_excel(
                os.path.join(base_path, "Progress for BI_OWF.xlsx"),
                "owf_db",
                "actual_units",
                resource_id_default='GCC_WF',
                allow_negative=True
            )
    else:
        main()
