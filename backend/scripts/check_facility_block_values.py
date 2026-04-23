#!/usr/bin/env python3
"""
验证 facilities / activity_summary / VFACTDB 中 block、main_block 的取值，
检查是否存在 LIKE '%12401%' 会误匹配的情况（如 124010、112401 等）。
运行: python backend/scripts/check_facility_block_values.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.database import SessionLocal
from app.models.report import VFACTDB
from app.models.activity_summary import ActivitySummary
from app.models.facility import Facility


def main():
    db = SessionLocal()
    try:
        print("=== 1. facilities 表: main_block 与 block 的 DISTINCT 值 ===\n")
        # main_block
        mb = db.query(Facility.main_block).filter(
            Facility.main_block.isnot(None), Facility.main_block != ""
        ).distinct().all()
        main_blocks = sorted({r[0] for r in mb if r[0]})
        print(f"main_block 取值 ({len(main_blocks)} 个): {main_blocks[:50]}...")
        # 检查是否有包含 12401 的子串可能误匹配
        if main_blocks:
            like_12401 = [v for v in main_blocks if "12401" in str(v)]
            print(f"main_block 中包含 '12401' 的值: {like_12401}")

        # block
        blk = db.query(Facility.block).filter(
            Facility.block.isnot(None), Facility.block != ""
        ).distinct().all()
        blocks = sorted({r[0] for r in blk if r[0]})
        print(f"\nblock 取值 ({len(blocks)} 个): {blocks[:50]}...")
        like_12401_blk = [v for v in blocks if "12401" in str(v)]
        print(f"block 中包含 '12401' 的值: {like_12401_blk}")

        print("\n=== 2. VFACTDB: main_block、block 中含 '12401' 的 DISTINCT 值 ===\n")
        mb_vf = db.query(VFACTDB.main_block).filter(
            VFACTDB.main_block.isnot(None), VFACTDB.main_block != ""
        ).distinct().all()
        main_blocks_vf = sorted({r[0] for r in mb_vf if r[0]})
        like_12401_vf_mb = [v for v in main_blocks_vf if "12401" in str(v)]
        print(f"VFACTDB.main_block 中含 '12401': {like_12401_vf_mb}")

        blk_vf = db.query(VFACTDB.block).filter(
            VFACTDB.block.isnot(None), VFACTDB.block != ""
        ).distinct().all()
        blocks_vf = sorted({r[0] for r in blk_vf if r[0]})
        like_12401_vf_blk = [v for v in blocks_vf if "12401" in str(v)]
        print(f"VFACTDB.block 中含 '12401': {like_12401_vf_blk}")

        print("\n=== 3. 结论 ===\n")
        # 检查是否存在 x 含 12401 但 x != 12401 且 x 不是 12401-xx 形式
        problematic = []
        for v in (like_12401_blk + like_12401_vf_blk + like_12401_vf_mb):
            if v and "12401" in str(v) and v != "12401" and not (
                str(v).startswith("12401-") or "-12401-" in str(v) or str(v).endswith("-12401")
            ):
                problematic.append(v)
        if problematic:
            print(f"可能被 LIKE '%12401%' 误匹配的值（非 12401、非 12401-xx 等形式）: {list(set(problematic))}")
        else:
            print("未发现会被 LIKE '%12401%' 误匹配的值（facilities/VFACTDB 中 block、main_block 取值规范）")
    finally:
        db.close()


if __name__ == "__main__":
    main()
