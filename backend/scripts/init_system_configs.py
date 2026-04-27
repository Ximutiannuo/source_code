"""
初始化系统配置脚本
插入默认的系统配置参数
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import inspect
from app.database import engine, SessionLocal
from app.models.config import SystemConfig
import traceback


def init_system_configs():
    """
    初始化系统配置
    插入默认配置参数，如果已存在则更新
    """
    db = SessionLocal()
    try:
        print("=" * 60)
        print("初始化系统配置")
        print("=" * 60)
        
        # 检查表是否存在
        inspector = inspect(engine.connect().engine)
        if "system_configs" not in inspector.get_table_names():
            print("错误: system_configs 表不存在，请先运行 migrate_create_system_configs_table.py")
            return False
        
        # 默认配置项
        default_configs = [
            {
                "key": "calculation.hours_per_day",
                "value": "10",
                "value_type": "decimal",
                "description": "人工天转人工时系数（小时/天），用于将人工天转换为人工时",
                "category": "calculation",
                "is_active": True
            },
            {
                "key": "calculation.weight_factor_base",
                "value": "254137500",
                "value_type": "decimal",
                "description": "权重因子基数，分配给施工的权重总值，用于计算活动的权重因子",
                "category": "calculation",
                "is_active": True
            }
        ]
        
        inserted_count = 0
        updated_count = 0
        
        for config_data in default_configs:
            key = config_data["key"]
            
            # 检查配置是否已存在
            existing_config = db.query(SystemConfig).filter(
                SystemConfig.key == key
            ).first()
            
            if existing_config:
                # 更新现有配置
                for attr, value in config_data.items():
                    if attr != "key":  # 不更新 key
                        setattr(existing_config, attr, value)
                updated_count += 1
                print(f"  ✓ 更新配置: {key}")
            else:
                # 插入新配置
                new_config = SystemConfig(**config_data)
                db.add(new_config)
                inserted_count += 1
                print(f"  ✓ 插入配置: {key}")
        
        db.commit()
        
        print("\n" + "=" * 60)
        print(f"配置初始化完成: 插入 {inserted_count} 条，更新 {updated_count} 条")
        print("=" * 60)
        return True
        
    except Exception as e:
        db.rollback()
        print(f"\n错误: {e}")
        print(f"详细信息: {traceback.format_exc()}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = init_system_configs()
    sys.exit(0 if success else 1)

