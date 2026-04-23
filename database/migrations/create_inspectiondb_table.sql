-- 创建 inspectiondb 与 rfi_groundfields 表（验收日报）

CREATE TABLE IF NOT EXISTS `inspectiondb` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rfi_id` VARCHAR(255) NOT NULL COMMENT 'RFI 编号',
  `rfi_issue_date` DATE NULL COMMENT 'RFI 发布日期',
  `rfi_inspection_date` DATETIME NULL COMMENT '验收日期时间',

  `activity_id` VARCHAR(100) NULL COMMENT '作业ID（可为空）',
  `scope` VARCHAR(100) NULL COMMENT 'Scope/承包商',
  `project` VARCHAR(50) NULL COMMENT 'Project',
  `subproject` VARCHAR(50) NULL COMMENT 'Sub-project',
  `implement_phase` VARCHAR(50) NULL COMMENT '实施阶段',
  `train` VARCHAR(50) NULL COMMENT 'Train',
  `unit` VARCHAR(50) NULL COMMENT 'Unit',
  `block` VARCHAR(50) NULL COMMENT 'Block',
  `quarter` VARCHAR(50) NULL COMMENT 'Quarter',
  `main_block` VARCHAR(50) NULL COMMENT 'Main_Block',
  `title` TEXT NULL COMMENT 'Title / 图号',
  `rfi_description` TEXT NULL COMMENT 'RFI/验收简要描述',
  `discipline` VARCHAR(50) NULL COMMENT 'Discipline',
  `work_package` VARCHAR(50) NULL COMMENT 'Work Package',

  `matched_drawing_number` JSON NULL COMMENT '匹配的图纸编号列表(JSON数组，仅 document_number)',

  `itp_no` VARCHAR(255) NULL COMMENT 'ITP 编号',
  `inspection_type` VARCHAR(100) NULL COMMENT '验收类型',
  `ground_of_works` VARCHAR(100) NULL COMMENT '工作依据编码（用于与 rfi_groundfields / rsc_defines.rfi_a/b/c 匹配）',
  `inspection_conclusion` TEXT NULL COMMENT '验收结论',
  `comments` TEXT NULL COMMENT '评论',
  `fixing_problems_details` TEXT NULL COMMENT '问题整改说明',
  `verification_date` DATE NULL COMMENT '验证日期',
  `qc_inspector` VARCHAR(255) NULL COMMENT '质检员',
  `note` TEXT NULL COMMENT '备注',
  `request_no` VARCHAR(255) NULL COMMENT '申请编号',

  `rfi_quantity` DECIMAL(38,20) NULL COMMENT '本条验收数量',
  `is_key_rfi_aggregation` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否用于 A/B/C 聚合（预留）',

  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` INT NULL COMMENT '最后修改人ID',
  `updated_method` VARCHAR(50) NULL COMMENT '修改方式: inspection_daily_report, manual_edit, excel_import, system_sync',
  `is_system_sync` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为系统同步数据',

  INDEX `idx_inspectiondb_rfi` (`rfi_id`),
  INDEX `idx_inspectiondb_date_activity` (`rfi_inspection_date`, `activity_id`),
  INDEX `idx_inspectiondb_scope_block` (`scope`, `block`),
  INDEX `idx_inspectiondb_block_discipline` (`block`, `discipline`),
  INDEX `idx_inspectiondb_ground` (`ground_of_works`),

  CONSTRAINT `fk_inspectiondb_activity` FOREIGN KEY (`activity_id`) REFERENCES `activity_summary`(`activity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `rfi_groundfields` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(100) NOT NULL COMMENT 'Ground 编码（如 3.1, 4.5）',
  `description` VARCHAR(255) NULL COMMENT '描述',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否激活',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY `uk_rfi_ground_code` (`code`),
  INDEX `idx_rfi_ground_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

