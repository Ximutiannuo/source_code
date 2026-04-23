import sys
from pathlib import Path
import traceback

# 添加项目根目录和 backend 目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from app.database import SessionLocal, engine
from sqlalchemy import text

def unify_collation():
    db = SessionLocal()
    try:
        print("开始全库排序规则统一行动 (目标: utf8mb4_unicode_ci)...")
        
        # 1. 禁用外键检查，防止由于关联表排序规则不一致导致修改失败
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        print("  ✓ 已暂时禁用外键检查")
        
        # 2. 修改数据库级别的默认排序规则
        db_name = engine.url.database
        print(f"正在修改数据库 {db_name} 的默认排序规则...")
        db.execute(text(f"ALTER DATABASE {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
        
        # 3. 获取所有表名
        tables = db.execute(text("SHOW TABLES")).all()
        table_names = [row[0] for row in tables]
        
        for table in table_names:
            print(f"  正在处理表: {table}...")
            try:
                # 转换整个表及其所有字符字段
                db.execute(text(f"ALTER TABLE {table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                
                # 设置表的默认字符集（用于后续新增列）
                db.execute(text(f"ALTER TABLE {table} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                
                print(f"    ✓ {table} 已统一")
            except Exception as e:
                print(f"    ❌ 处理 {table} 时出错: {e}")
        
        # 4. 重新启用外键检查
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        print("\n  ✓ 已重新启用外键检查")
        
        db.commit()
        print("\n✅ 全库排序规则统一完成！所有表和字段均已设为 utf8mb4_unicode_ci。")
        
    except Exception as e:
        db.rollback()
        # 确保出错时也能重新启用外键检查
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        except:
            pass
        print(f"\n❌ 统一失败: {e}")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    unify_collation()