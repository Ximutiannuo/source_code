-- 内部协作评价系统：issue_rating 表
-- 评分与低分原因独立于 ahead_plan_issue，支持延迟展示、匿名汇总
CREATE TABLE IF NOT EXISTS `issue_rating` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `issue_id` INT NOT NULL COMMENT '关联 ahead_plan_issue.id',
  `rating` TINYINT NOT NULL COMMENT '评分 1-5',
  `rating_reason` VARCHAR(200) NULL COMMENT '低分原因，3星及以下必填',
  `rating_reason_tags` JSON NULL COMMENT '预设标签，如 ["响应慢","推诿","沟通不畅","未解决"]',
  `visible_after` DATETIME NULL COMMENT '评分对责任人可见时间（延迟展示）',
  `confirmed_at` DATETIME NOT NULL,
  `confirmed_by` INT NOT NULL COMMENT '提出人 user.id',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_issue_rating_issue` (`issue_id`),
  INDEX `idx_issue_rating_responsible` (`visible_after`),
  INDEX `idx_issue_rating_confirmed_by` (`confirmed_by`),
  CONSTRAINT `fk_issue_rating_issue` FOREIGN KEY (`issue_id`) REFERENCES `ahead_plan_issue` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='问题协作反馈表';
