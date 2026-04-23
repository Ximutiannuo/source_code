-- 为vfactdb和mpdb创建优化索引
-- 这些索引可以大幅提升SQL聚合查询的性能

-- VFACTDB索引：用于按activity_id聚合achieved
-- 如果已有索引，可以忽略（MySQL会自动处理）
CREATE INDEX IF NOT EXISTS idx_vfactdb_activity_id 
ON vfactdb(activity_id) 
WHERE activity_id IS NOT NULL;

-- 如果MySQL不支持WHERE子句（旧版本），使用：
-- CREATE INDEX idx_vfactdb_activity_id ON vfactdb(activity_id);

-- 覆盖索引：包含activity_id和achieved，避免回表
CREATE INDEX IF NOT EXISTS idx_vfactdb_activity_achieved 
ON vfactdb(activity_id, achieved) 
WHERE activity_id IS NOT NULL;

-- MPDB索引：用于按activity_id聚合manpower和日期范围
CREATE INDEX IF NOT EXISTS idx_mpdb_activity_id 
ON mpdb(activity_id) 
WHERE activity_id IS NOT NULL;

-- 复合索引：包含activity_id, date, manpower，用于聚合和MIN/MAX
-- 这个索引可以覆盖大部分查询需求
CREATE INDEX IF NOT EXISTS idx_mpdb_activity_date_manpower 
ON mpdb(activity_id, date, manpower) 
WHERE activity_id IS NOT NULL;

-- 如果MySQL不支持WHERE子句，使用：
-- CREATE INDEX idx_mpdb_activity_date_manpower ON mpdb(activity_id, date, manpower);

-- 查看索引创建情况
-- SHOW INDEX FROM vfactdb;
-- SHOW INDEX FROM mpdb;

