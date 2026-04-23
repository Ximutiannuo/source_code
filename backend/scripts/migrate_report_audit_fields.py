import os
import sys
import argparse
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import InternalError, OperationalError

# 将backend目录添加到路径，以便导入app
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.database import engine, SessionLocal
from app.models.report import MPDB, VFACTDB

def migrate():
    print("开始数据库审计字段迁移...")
    db = SessionLocal()
    try:
        # 1. 验证连接
        db.execute(text("SELECT 1"))
        print("数据库连接成功。")

        # 2. 获取表结构信息
        # 检查 mpdb
        mpdb_cols = db.execute(text("SHOW COLUMNS FROM mpdb")).fetchall()
        mpdb_col_names = [col[0] for col in mpdb_cols]
        
        # 检查 vfactdb
        vfactdb_cols = db.execute(text("SHOW COLUMNS FROM vfactdb")).fetchall()
        vfactdb_col_names = [col[0] for col in vfactdb_cols]

        # 3. 执行迁移 - MPDB
        print("\n检查 mpdb 表...")
        if "updated_by" not in mpdb_col_names:
            print("添加 mpdb.updated_by...")
            db.execute(text("ALTER TABLE mpdb ADD COLUMN updated_by INT NULL COMMENT '最后修改人ID' AFTER updated_at"))
        
        if "update_method" not in mpdb_col_names:
            print("添加 mpdb.update_method...")
            db.execute(text("ALTER TABLE mpdb ADD COLUMN update_method VARCHAR(50) NULL COMMENT '修改方式' AFTER updated_by"))
        
        # 检查外键
        try:
            db.execute(text("ALTER TABLE mpdb ADD CONSTRAINT fk_mpdb_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL"))
            print("mpdb 外键约束添加成功。")
        except Exception as e:
            if any(code in str(e) for code in ["1215", "1826", "Duplicate", "1061", "1022"]):
                print("mpdb 外键约束已存在或冲突，跳过。")
            else:
                print(f"添加 mpdb 外键约束时遇到警告: {e}")

        # 4. 执行迁移 - VFACTDB
        print("\n检查 vfactdb 表...")
        if "updated_by" not in vfactdb_col_names:
            print("添加 vfactdb.updated_by...")
            db.execute(text("ALTER TABLE vfactdb ADD COLUMN updated_by INT NULL COMMENT '最后修改人ID' AFTER updated_at"))
        
        if "update_method" not in vfactdb_col_names:
            print("添加 vfactdb.update_method...")
            db.execute(text("ALTER TABLE vfactdb ADD COLUMN update_method VARCHAR(50) NULL COMMENT '修改方式' AFTER updated_by"))
        
        # 检查外键
        try:
            db.execute(text("ALTER TABLE vfactdb ADD CONSTRAINT fk_vfactdb_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL"))
            print("vfactdb 外键约束添加成功。")
        except Exception as e:
            if any(code in str(e) for code in ["1215", "1826", "Duplicate", "1061", "1022"]):
                print("vfactdb 外键约束已存在或冲突，跳过。")
            else:
                print(f"添加 vfactdb 外键约束时遇到警告: {e}")

        # 5. 同步数据：将 is_system_sync = 1 的记录标记为 update_method = 'system_sync'
        print("\n同步历史数据...")
        vfact_sync_count = db.execute(text(
            "UPDATE vfactdb SET update_method = 'system_sync' WHERE is_system_sync = 1 AND update_method IS NULL"
        )).rowcount
        print(f"已更新 {vfact_sync_count} 条 vfactdb 记录的 update_method 为 'system_sync'。")

        db.commit()
        print("\n所有操作已提交。")

        # 6. 验证
        print("\n验证迁移结果...")
        new_vfactdb_cols = [col[0] for col in db.execute(text("SHOW COLUMNS FROM vfactdb")).fetchall()]
        if "updated_by" in new_vfactdb_cols and "update_method" in new_vfactdb_cols:
            print("验证通过：审计字段已成功添加。")
        else:
            print("验证失败：字段可能未正确添加。")

    except Exception as e:
        db.rollback()
        print(f"\n迁移过程中出错: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
