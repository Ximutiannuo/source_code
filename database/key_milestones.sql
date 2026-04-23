-- 关键里程碑表（可选）：供首页「关键里程碑」展示，由脚本导入或运维在管理界面维护。
-- 执行后可通过 GET /api/dashboard/key-milestones 读取；未执行则接口返回空数组，前端使用写死数据。
CREATE TABLE IF NOT EXISTS `key_milestones` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `year` VARCHAR(8) NOT NULL,
    `month` VARCHAR(16) NOT NULL,
    `label` VARCHAR(64) NOT NULL,
    `status` VARCHAR(32) NOT NULL COMMENT 'done|delayed|future',
    `sort_order` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 示例数据（可按需删除或修改）
-- INSERT INTO key_milestones (year, month, label, status, sort_order) VALUES
-- ('2026', 'Jan', 'EN', 'done', 1),
-- ('2026', 'Feb', 'EN delayed', 'delayed', 2),
-- ('2026', 'Jun', 'M1', 'future', 3),
-- ('2026', 'Oct', 'M2', 'future', 4),
-- ('2027', 'Jan', 'M3', 'future', 5),
-- ('2027', 'Mar', 'M4', 'future', 6);
