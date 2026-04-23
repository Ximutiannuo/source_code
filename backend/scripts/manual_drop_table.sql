-- 手动DROP表的SQL脚本
-- 如果force_clear_table.py无法DROP表，可以在MySQL客户端中手动执行这些命令

-- 1. 先禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- 2. 删除表
DROP TABLE IF EXISTS p6_activity_code_assignments;

-- 3. 重新启用外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- 注意：删除表后，需要使用SQLAlchemy模型或CREATE TABLE语句重新创建表
