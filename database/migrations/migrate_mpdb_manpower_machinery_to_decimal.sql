-- 将MPDB表的manpower和machinery字段从INT改为DECIMAL(38,20)
-- 执行日期: 请根据实际情况填写
-- 执行前请备份数据库

USE projectcontrols;

-- 修改manpower字段类型
ALTER TABLE mpdb 
MODIFY COLUMN manpower DECIMAL(38,20) COMMENT '人力数量' 
DEFAULT 0;

-- 修改machinery字段类型
ALTER TABLE mpdb 
MODIFY COLUMN machinery DECIMAL(38,20) COMMENT '机械数量' 
DEFAULT 0;

-- 注意：
-- 1. 执行前请备份数据库
-- 2. 如果表中有大量数据，此操作可能需要一些时间
-- 3. 执行时表会被锁定，建议在维护窗口期间执行
-- 4. 现有数据会自动转换：整数会转换为对应的DECIMAL值（例如：5 -> 5.00000000000000000000）
-- 5. 如果字段中有NULL值，将保持为NULL
