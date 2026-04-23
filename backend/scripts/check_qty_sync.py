import sys
from pathlib import Path

# 添加项目根目录和 backend 目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # 查找一些 activity_id，看看其 key_qty 和 workstep_volumes 的情况
    sql = text("""
        SELECT 
            asum.activity_id, 
            asum.key_qty, 
            (SELECT SUM(estimated_total) FROM workstep_volumes wv WHERE wv.activity_id = asum.activity_id) as wv_sum,
            vc.estimated_total as vc_qty
        FROM activity_summary asum
        LEFT JOIN volume_control_quantity vc ON asum.activity_id = vc.activity_id
        WHERE asum.key_qty IS NULL OR asum.key_qty = 0
        LIMIT 10
    """)
    results = db.execute(sql).fetchall()
    print("Activity ID | ActivitySummary.key_qty | WorkStepVolume Sum | VolumeControlQuantity.estimated_total")
    print("-" * 100)
    for r in results:
        # 处理空值显示
        qty = str(r[1]) if r[1] is not None else "None"
        wv_sum = str(r[2]) if r[2] is not None else "None"
        vc_qty = str(r[3]) if r[3] is not None else "None"
        print(f"{r[0]:<12} | {qty:<23} | {wv_sum:<18} | {vc_qty}")
finally:
    db.close()
