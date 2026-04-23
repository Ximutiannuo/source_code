-- 为 mpdb 和 vfactdb 添加审计字段
USE projectcontrols;

-- 1. 处理 mpdb 表
ALTER TABLE mpdb 
ADD COLUMN updated_by INT NULL COMMENT '最后修改人ID' AFTER updated_at,
ADD COLUMN update_method VARCHAR(50) NULL COMMENT '修改方式: daily_report, manual_edit, excel_import, system_sync' AFTER updated_by;

-- 添加外键约束
ALTER TABLE mpdb 
ADD CONSTRAINT fk_mpdb_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- 2. 处理 vfactdb 表
ALTER TABLE vfactdb 
ADD COLUMN updated_by INT NULL COMMENT '最后修改人ID' AFTER updated_at,
ADD COLUMN update_method VARCHAR(50) NULL COMMENT '修改方式: daily_report, manual_edit, excel_import, batch_adjust, system_sync, welding_sync' AFTER updated_by;

-- 添加外键约束
ALTER TABLE vfactdb 
ADD CONSTRAINT fk_vfactdb_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
