-- 调整 activity_summary 表中 actual_weight_factor 列的位置
-- 将其移动到 weight_factor 列之后

-- MySQL/MariaDB 语法
ALTER TABLE activity_summary 
MODIFY COLUMN actual_weight_factor NUMERIC(18, 2) COMMENT 'Actual Weight Factor (基于实际完成工时计算)' 
AFTER weight_factor;

-- 注意：
-- 1. 执行前请备份数据库
-- 2. 如果表中有大量数据，此操作可能需要一些时间
-- 3. 执行时表会被锁定，建议在维护窗口期间执行
