-- ============================================================================
-- P6表添加p6_create_date和p6_last_update_date字段的迁移脚本
-- ============================================================================
-- 说明：
-- 1. 先kill相关连接，避免ALTER TABLE时锁表
-- 2. 为所有p6_*表添加p6_create_date和p6_last_update_date字段
-- 3. 为p6_activities表额外添加data_date和baseline1_duration字段
-- 4. 为新字段创建索引（用于增量同步查询）
-- ============================================================================

-- 设置SQL模式，避免严格模式导致的错误
SET SESSION sql_mode = '';

-- ============================================================================
-- 第一步：Kill相关连接（避免ALTER TABLE时锁表）
-- ============================================================================
-- 注意：这会断开所有正在使用这些表的连接
-- 建议在维护窗口期间执行

-- 查找并kill正在使用p6_*表的连接
-- 注意：需要根据实际情况调整数据库名称
SELECT CONCAT('KILL ', id, ';') AS kill_command
FROM information_schema.processlist
WHERE db = DATABASE()
  AND (
    info LIKE '%p6_activities%' OR
    info LIKE '%p6_wbs%' OR
    info LIKE '%p6_projects%' OR
    info LIKE '%p6_eps%' OR
    info LIKE '%p6_activity_codes%' OR
    info LIKE '%p6_resources%' OR
    info LIKE '%p6_activity_code_assignments%' OR
    info LIKE '%p6_resource_assignments%'
  )
  AND id != CONNECTION_ID();

-- 手动执行上面查询结果中的KILL命令，或者使用下面的存储过程
-- 注意：下面的代码需要根据实际情况调整

-- ============================================================================
-- 第二步：为所有p6_*表添加字段
-- ============================================================================

-- p6_activities: 添加p6_create_date, p6_last_update_date, data_date, baseline1_duration
ALTER TABLE p6_activities 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）',
  ADD COLUMN data_date DATETIME NULL COMMENT 'Data Date',
  ADD COLUMN baseline1_duration DECIMAL(18, 2) NULL COMMENT 'Baseline1 Duration';

-- p6_wbs: 添加p6_create_date, p6_last_update_date
ALTER TABLE p6_wbs 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）';

-- p6_projects: 添加p6_create_date, p6_last_update_date
ALTER TABLE p6_projects 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）';

-- p6_eps: 添加p6_create_date, p6_last_update_date
ALTER TABLE p6_eps 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）';

-- p6_activity_codes: 添加p6_create_date, p6_last_update_date
ALTER TABLE p6_activity_codes 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）';

-- p6_resources: 添加p6_create_date, p6_last_update_date
ALTER TABLE p6_resources 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）';

-- p6_activity_code_assignments: 添加p6_create_date, p6_last_update_date
ALTER TABLE p6_activity_code_assignments 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）';

-- p6_resource_assignments: 添加p6_create_date, p6_last_update_date
ALTER TABLE p6_resource_assignments 
  ADD COLUMN p6_create_date DATETIME NULL COMMENT 'P6 CreateDate（记录创建时间）',
  ADD COLUMN p6_last_update_date DATETIME NULL COMMENT 'P6 LastUpdateDate（记录最后更新时间，用于增量同步）';

-- ============================================================================
-- 第三步：为新字段创建索引（用于增量同步查询）
-- ============================================================================

-- 为p6_last_update_date字段创建索引（用于增量同步时查询最大值）
CREATE INDEX idx_p6_activities_last_update_date ON p6_activities(p6_last_update_date);
CREATE INDEX idx_p6_wbs_last_update_date ON p6_wbs(p6_last_update_date);
CREATE INDEX idx_p6_projects_last_update_date ON p6_projects(p6_last_update_date);
CREATE INDEX idx_p6_eps_last_update_date ON p6_eps(p6_last_update_date);
CREATE INDEX idx_p6_activity_codes_last_update_date ON p6_activity_codes(p6_last_update_date);
CREATE INDEX idx_p6_resources_last_update_date ON p6_resources(p6_last_update_date);
CREATE INDEX idx_p6_activity_code_assignments_last_update_date ON p6_activity_code_assignments(p6_last_update_date);
CREATE INDEX idx_p6_resource_assignments_last_update_date ON p6_resource_assignments(p6_last_update_date);

-- ============================================================================
-- 完成
-- ============================================================================
-- 迁移完成后，下次同步时会自动填充这些字段的值
-- 注意：现有记录的p6_create_date和p6_last_update_date将为NULL，直到下次同步时才会填充
-- ============================================================================

