-- 数据库迁移脚本：修改 VFACTDB.achieved 字段精度
-- 从 DECIMAL(18,2) 改为 DECIMAL(38,20) - 完全保留Excel原始精度
-- 
-- 使用方法：
-- 1. 使用 MySQL 客户端连接数据库
-- 2. 选择数据库：USE projectcontrols;
-- 3. 执行此 SQL 脚本

-- 检查当前字段类型
SELECT 
    COLUMN_TYPE,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'vfactdb'
AND COLUMN_NAME = 'achieved';

-- 执行迁移：修改字段类型
ALTER TABLE vfactdb 
MODIFY COLUMN achieved DECIMAL(38,20) 
COMMENT 'Achieved - 完成工程量（保留20位小数精度，完全保留Excel原始精度）';

-- 验证迁移结果
SELECT 
    COLUMN_TYPE,
    COLUMN_NAME,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'vfactdb'
AND COLUMN_NAME = 'achieved';

