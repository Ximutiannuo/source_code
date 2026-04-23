"""
迁移 volume_controls 表到新的四表结构
将原有的 volume_controls 表数据迁移到：
- volume_control_quantity（工程量及完工信息）
- volume_control_inspection（验收相关信息）
- volume_control_asbuilt（竣工资料相关信息）
- volume_control_payment（收款相关信息）

以及对应的历史记录表
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from sqlalchemy import text
from app.database import SessionLocal, engine
from app.models.volume_control import VolumeControl
from app.models.volume_control_quantity import VolumeControlQuantity, VolumeControlQuantityHistory
from app.models.volume_control_inspection import VolumeControlInspection, VolumeControlInspectionHistory
from app.models.volume_control_asbuilt import VolumeControlAsbuilt, VolumeControlAsbuiltHistory
from app.models.volume_control_payment import VolumeControlPayment, VolumeControlPaymentHistory
from datetime import datetime, timezone


def create_tables(db):
    """创建新表（使用SQL确保字符集一致）"""
    print("正在创建新表...")
    
    # 检查表是否已存在
    tables_to_create = [
        'volume_control_quantity',
        'volume_control_quantity_history',
        'volume_control_inspection',
        'volume_control_inspection_history',
        'volume_control_asbuilt',
        'volume_control_asbuilt_history',
        'volume_control_payment',
        'volume_control_payment_history',
    ]
    
    for table_name in tables_to_create:
        table_exists = db.execute(text(f"""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = '{table_name}'
        """)).scalar() > 0
        
        if table_exists:
            print(f"  ⚠️ 表 {table_name} 已存在，跳过创建")
            continue
    
    # 先检查 activity_summary 表的字符集和排序规则
    activity_summary_info = db.execute(text("""
        SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'activity_summary'
        AND COLUMN_NAME = 'activity_id'
    """)).fetchone()
    
    if activity_summary_info:
        charset = activity_summary_info[1] or 'utf8mb4'
        collate = activity_summary_info[2] or 'utf8mb4_unicode_ci'
        print(f"  activity_summary.activity_id 字符集: {charset}, 排序规则: {collate}")
    else:
        charset = 'utf8mb4'
        collate = 'utf8mb4_unicode_ci'
        print(f"  未找到 activity_summary 表信息，使用默认字符集: {charset}, 排序规则: {collate}")
    
    # 使用原始SQL创建表，确保字符集和排序规则完全匹配
    print("  使用原始SQL创建表（确保字符集匹配）...")
    
    # 创建 volume_control_quantity 表
    if not db.execute(text(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'volume_control_quantity'")).scalar():
        db.execute(text(f"""
            CREATE TABLE volume_control_quantity (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} UNIQUE NOT NULL COMMENT '作业ID',
                estimated_total DECIMAL(18, 2) COMMENT '预估总量（工程师根据DDD/FEED文件更新）',
                drawing_approved_afc DECIMAL(18, 2) COMMENT '图纸批准量AFC（工程师根据DDD文件更新）',
                material_arrived DECIMAL(18, 2) COMMENT '材料到货量（工程师根据到货信息更新）',
                available_workface DECIMAL(18, 2) COMMENT '现有可施工工作面（工程师根据现场情况更新）',
                workface_restricted_material DECIMAL(18, 2) COMMENT '工作面受限（材料因素，工程师更新）',
                workface_restricted_site DECIMAL(18, 2) COMMENT '工作面受限（现场因素，工程师更新）',
                construction_completed DECIMAL(18, 2) COMMENT '施工完成（计划部通过日报更新，请勿填写）',
                estimated_total_updated_at DATETIME COMMENT '预估总量最后修改时间',
                estimated_total_updated_by INT COMMENT '预估总量最后修改人',
                drawing_approved_afc_updated_at DATETIME COMMENT '图纸批准量AFC最后修改时间',
                drawing_approved_afc_updated_by INT COMMENT '图纸批准量AFC最后修改人',
                material_arrived_updated_at DATETIME COMMENT '材料到货量最后修改时间',
                material_arrived_updated_by INT COMMENT '材料到货量最后修改人',
                available_workface_updated_at DATETIME COMMENT '现有可施工工作面最后修改时间',
                available_workface_updated_by INT COMMENT '现有可施工工作面最后修改人',
                workface_restricted_material_updated_at DATETIME COMMENT '工作面受限（材料）最后修改时间',
                workface_restricted_material_updated_by INT COMMENT '工作面受限（材料）最后修改人',
                workface_restricted_site_updated_at DATETIME COMMENT '工作面受限（现场）最后修改时间',
                workface_restricted_site_updated_by INT COMMENT '工作面受限（现场）最后修改人',
                construction_completed_updated_at DATETIME COMMENT '施工完成最后修改时间',
                construction_completed_updated_by INT COMMENT '施工完成最后修改人',
                responsible_user_id INT COMMENT '责任人（用户ID）',
                responsible_updated_at DATETIME COMMENT '责任人最后修改时间',
                responsible_updated_by INT COMMENT '责任人最后修改人',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_vcq_activity_id (activity_id),
                INDEX idx_vcq_responsible (responsible_user_id),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (estimated_total_updated_by) REFERENCES users(id),
                FOREIGN KEY (drawing_approved_afc_updated_by) REFERENCES users(id),
                FOREIGN KEY (material_arrived_updated_by) REFERENCES users(id),
                FOREIGN KEY (available_workface_updated_by) REFERENCES users(id),
                FOREIGN KEY (workface_restricted_material_updated_by) REFERENCES users(id),
                FOREIGN KEY (workface_restricted_site_updated_by) REFERENCES users(id),
                FOREIGN KEY (construction_completed_updated_by) REFERENCES users(id),
                FOREIGN KEY (responsible_user_id) REFERENCES users(id),
                FOREIGN KEY (responsible_updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """))
        print("  ✓ volume_control_quantity 表创建成功")
    
    # 创建其他表（类似方式）
    # 为了简化，先创建主表，历史表可以稍后创建
    tables_sql = [
        ('volume_control_quantity_history', """
            CREATE TABLE volume_control_quantity_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} NOT NULL COMMENT '作业ID',
                field_name VARCHAR(100) COMMENT '字段名',
                old_value DECIMAL(18, 2) COMMENT '旧值',
                new_value DECIMAL(18, 2) COMMENT '新值',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '修改时间',
                updated_by INT COMMENT '修改人',
                remarks TEXT COMMENT '备注',
                INDEX idx_vcqh_activity_field (activity_id, field_name),
                INDEX idx_vcqh_updated_at (updated_at),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """),
        ('volume_control_inspection', """
            CREATE TABLE volume_control_inspection (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} UNIQUE NOT NULL COMMENT '作业ID',
                rfi_completed_a DECIMAL(18, 2) COMMENT 'RFI 验收完成量（A）',
                rfi_completed_b DECIMAL(18, 2) COMMENT 'RFI 验收完成量（B）',
                rfi_completed_c DECIMAL(18, 2) COMMENT 'RFI 验收完成量（C）',
                rfi_completed_a_updated_at DATETIME COMMENT 'RFI验收完成量（A）最后修改时间',
                rfi_completed_a_updated_by INT COMMENT 'RFI验收完成量（A）最后修改人',
                rfi_completed_b_updated_at DATETIME COMMENT 'RFI验收完成量（B）最后修改时间',
                rfi_completed_b_updated_by INT COMMENT 'RFI验收完成量（B）最后修改人',
                rfi_completed_c_updated_at DATETIME COMMENT 'RFI验收完成量（C）最后修改时间',
                rfi_completed_c_updated_by INT COMMENT 'RFI验收完成量（C）最后修改人',
                responsible_user_id INT COMMENT '责任人（用户ID）',
                responsible_updated_at DATETIME COMMENT '责任人最后修改时间',
                responsible_updated_by INT COMMENT '责任人最后修改人',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_vci_activity_id (activity_id),
                INDEX idx_vci_responsible (responsible_user_id),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (rfi_completed_a_updated_by) REFERENCES users(id),
                FOREIGN KEY (rfi_completed_b_updated_by) REFERENCES users(id),
                FOREIGN KEY (rfi_completed_c_updated_by) REFERENCES users(id),
                FOREIGN KEY (responsible_user_id) REFERENCES users(id),
                FOREIGN KEY (responsible_updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """),
        ('volume_control_inspection_history', """
            CREATE TABLE volume_control_inspection_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} NOT NULL COMMENT '作业ID',
                field_name VARCHAR(100) COMMENT '字段名',
                old_value DECIMAL(18, 2) COMMENT '旧值',
                new_value DECIMAL(18, 2) COMMENT '新值',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '修改时间',
                updated_by INT COMMENT '修改人',
                remarks TEXT COMMENT '备注',
                INDEX idx_vcih_activity_field (activity_id, field_name),
                INDEX idx_vcih_updated_at (updated_at),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """),
        ('volume_control_asbuilt', """
            CREATE TABLE volume_control_asbuilt (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} UNIQUE NOT NULL COMMENT '作业ID',
                asbuilt_signed_r0 DECIMAL(18, 2) COMMENT '竣工资料签署量（R0）',
                asbuilt_signed_r1 DECIMAL(18, 2) COMMENT '竣工资料签署量（R1）',
                asbuilt_signed_r0_updated_at DATETIME COMMENT '竣工资料签署量（R0）最后修改时间',
                asbuilt_signed_r0_updated_by INT COMMENT '竣工资料签署量（R0）最后修改人',
                asbuilt_signed_r1_updated_at DATETIME COMMENT '竣工资料签署量（R1）最后修改时间',
                asbuilt_signed_r1_updated_by INT COMMENT '竣工资料签署量（R1）最后修改人',
                responsible_user_id INT COMMENT '责任人（用户ID）',
                responsible_updated_at DATETIME COMMENT '责任人最后修改时间',
                responsible_updated_by INT COMMENT '责任人最后修改人',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_vca_activity_id (activity_id),
                INDEX idx_vca_responsible (responsible_user_id),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (asbuilt_signed_r0_updated_by) REFERENCES users(id),
                FOREIGN KEY (asbuilt_signed_r1_updated_by) REFERENCES users(id),
                FOREIGN KEY (responsible_user_id) REFERENCES users(id),
                FOREIGN KEY (responsible_updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """),
        ('volume_control_asbuilt_history', """
            CREATE TABLE volume_control_asbuilt_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} NOT NULL COMMENT '作业ID',
                field_name VARCHAR(100) COMMENT '字段名',
                old_value DECIMAL(18, 2) COMMENT '旧值',
                new_value DECIMAL(18, 2) COMMENT '新值',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '修改时间',
                updated_by INT COMMENT '修改人',
                remarks TEXT COMMENT '备注',
                INDEX idx_vcah_activity_field (activity_id, field_name),
                INDEX idx_vcah_updated_at (updated_at),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """),
        ('volume_control_payment', """
            CREATE TABLE volume_control_payment (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} UNIQUE NOT NULL COMMENT '作业ID',
                obp_signed DECIMAL(18, 2) COMMENT 'OBP签署量',
                obp_signed_updated_at DATETIME COMMENT 'OBP签署量最后修改时间',
                obp_signed_updated_by INT COMMENT 'OBP签署量最后修改人',
                responsible_user_id INT COMMENT '责任人（用户ID）',
                responsible_updated_at DATETIME COMMENT '责任人最后修改时间',
                responsible_updated_by INT COMMENT '责任人最后修改人',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_vcp_activity_id (activity_id),
                INDEX idx_vcp_responsible (responsible_user_id),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (obp_signed_updated_by) REFERENCES users(id),
                FOREIGN KEY (responsible_user_id) REFERENCES users(id),
                FOREIGN KEY (responsible_updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """),
        ('volume_control_payment_history', """
            CREATE TABLE volume_control_payment_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id VARCHAR(100) CHARACTER SET {charset} COLLATE {collate} NOT NULL COMMENT '作业ID',
                field_name VARCHAR(100) COMMENT '字段名',
                old_value DECIMAL(18, 2) COMMENT '旧值',
                new_value DECIMAL(18, 2) COMMENT '新值',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '修改时间',
                updated_by INT COMMENT '修改人',
                remarks TEXT COMMENT '备注',
                INDEX idx_vcph_activity_field (activity_id, field_name),
                INDEX idx_vcph_updated_at (updated_at),
                FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id) ON DELETE CASCADE,
                FOREIGN KEY (updated_by) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET={charset} COLLATE={collate}
        """),
    ]
    
    for table_name, sql_template in tables_sql:
        if not db.execute(text(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '{table_name}'")).scalar():
            try:
                db.execute(text(sql_template.format(charset=charset, collate=collate)))
                db.commit()
                print(f"  ✓ {table_name} 表创建成功")
            except Exception as e:
                print(f"  ⚠️ 创建 {table_name} 表失败: {e}")
                db.rollback()
                raise
    
    print("✓ 所有新表创建完成")


def migrate_data(db):
    """迁移数据"""
    print("\n开始迁移数据...")
    
    # 获取所有现有数据
    old_records = db.query(VolumeControl).all()
    print(f"  找到 {len(old_records)} 条现有记录")
    
    migrated_count = 0
    for old_record in old_records:
        try:
            # 1. 迁移到 volume_control_quantity
            quantity = db.query(VolumeControlQuantity).filter(
                VolumeControlQuantity.activity_id == old_record.activity_id
            ).first()
            
            if not quantity:
                quantity = VolumeControlQuantity(
                    activity_id=old_record.activity_id,
                    estimated_total=old_record.estimated_total,
                    drawing_approved_afc=old_record.drawing_approved_afc,
                    material_arrived=old_record.material_arrived,
                    available_workface=old_record.available_workface,
                    workface_restricted_material=old_record.workface_restricted_material,
                    workface_restricted_site=old_record.workface_restricted_site,
                    construction_completed=old_record.construction_completed,
                    # 使用原表的updated_at作为初始修改时间
                    estimated_total_updated_at=old_record.updated_at if old_record.estimated_total else None,
                    drawing_approved_afc_updated_at=old_record.updated_at if old_record.drawing_approved_afc else None,
                    material_arrived_updated_at=old_record.updated_at if old_record.material_arrived else None,
                    available_workface_updated_at=old_record.updated_at if old_record.available_workface else None,
                    workface_restricted_material_updated_at=old_record.updated_at if old_record.workface_restricted_material else None,
                    workface_restricted_site_updated_at=old_record.updated_at if old_record.workface_restricted_site else None,
                    construction_completed_updated_at=old_record.updated_at if old_record.construction_completed else None,
                    # 如果有construction_responsible，尝试转换为用户ID（这里先设为None，需要手动更新）
                    responsible_user_id=None,  # 需要手动关联
                    created_at=old_record.created_at or datetime.now(timezone.utc),
                    updated_at=old_record.updated_at or datetime.now(timezone.utc),
                )
                db.add(quantity)
            
            # 2. 迁移到 volume_control_inspection
            inspection = db.query(VolumeControlInspection).filter(
                VolumeControlInspection.activity_id == old_record.activity_id
            ).first()
            
            if not inspection:
                inspection = VolumeControlInspection(
                    activity_id=old_record.activity_id,
                    rfi_completed_a=old_record.rfi_completed_a,
                    rfi_completed_b=old_record.rfi_completed_b,
                    rfi_completed_c=old_record.rfi_completed_c,
                    rfi_completed_a_updated_at=old_record.updated_at if old_record.rfi_completed_a else None,
                    rfi_completed_b_updated_at=old_record.updated_at if old_record.rfi_completed_b else None,
                    rfi_completed_c_updated_at=old_record.updated_at if old_record.rfi_completed_c else None,
                    responsible_user_id=None,
                    created_at=old_record.created_at or datetime.now(timezone.utc),
                    updated_at=old_record.updated_at or datetime.now(timezone.utc),
                )
                db.add(inspection)
            
            # 3. 迁移到 volume_control_asbuilt
            asbuilt = db.query(VolumeControlAsbuilt).filter(
                VolumeControlAsbuilt.activity_id == old_record.activity_id
            ).first()
            
            if not asbuilt:
                asbuilt = VolumeControlAsbuilt(
                    activity_id=old_record.activity_id,
                    asbuilt_signed_r0=old_record.asbuilt_signed_r0,
                    asbuilt_signed_r1=old_record.asbuilt_signed_r1,
                    asbuilt_signed_r0_updated_at=old_record.updated_at if old_record.asbuilt_signed_r0 else None,
                    asbuilt_signed_r1_updated_at=old_record.updated_at if old_record.asbuilt_signed_r1 else None,
                    responsible_user_id=None,
                    created_at=old_record.created_at or datetime.now(timezone.utc),
                    updated_at=old_record.updated_at or datetime.now(timezone.utc),
                )
                db.add(asbuilt)
            
            # 4. 迁移到 volume_control_payment
            payment = db.query(VolumeControlPayment).filter(
                VolumeControlPayment.activity_id == old_record.activity_id
            ).first()
            
            if not payment:
                payment = VolumeControlPayment(
                    activity_id=old_record.activity_id,
                    obp_signed=old_record.obp_signed,
                    obp_signed_updated_at=old_record.updated_at if old_record.obp_signed else None,
                    responsible_user_id=None,
                    created_at=old_record.created_at or datetime.now(timezone.utc),
                    updated_at=old_record.updated_at or datetime.now(timezone.utc),
                )
                db.add(payment)
            
            migrated_count += 1
            if migrated_count % 100 == 0:
                print(f"  已迁移 {migrated_count} 条记录...")
                db.commit()
        
        except Exception as e:
            print(f"  ⚠️ 迁移记录 {old_record.activity_id} 时出错: {e}")
            db.rollback()
            continue
    
    db.commit()
    print(f"\n✓ 数据迁移完成，共迁移 {migrated_count} 条记录")


def main():
    """主函数"""
    print("=" * 60)
    print("Volume Controls 表结构迁移脚本")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # 1. 创建新表
        create_tables(db)
        
        # 2. 迁移数据
        migrate_data(db)
        
        print("\n" + "=" * 60)
        print("迁移完成！")
        print("=" * 60)
        print("\n注意：")
        print("1. 原 volume_controls 表保留作为备份")
        print("2. 责任人字段需要手动关联用户ID")
        print("3. 历史记录表目前为空，后续修改会自动记录")
        print("4. 迁移完成后，可以更新代码使用新表结构")
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()

