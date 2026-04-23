-- 修复迁移后的联合索引
-- 如果索引已存在，先删除再创建

-- 修复 mpdb 表的联合索引
DROP INDEX IF EXISTS `idx_mpdb_date_activity_id` ON `mpdb`;
CREATE INDEX `idx_mpdb_date_activity_id` ON `mpdb` (`date`, `activity_id`);

-- 修复 vfactdb 表的联合索引
DROP INDEX IF EXISTS `idx_vfactdb_date_activity_id` ON `vfactdb`;
CREATE INDEX `idx_vfactdb_date_activity_id` ON `vfactdb` (`date`, `activity_id`);

