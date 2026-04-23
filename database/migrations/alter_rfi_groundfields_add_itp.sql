-- 新增 ITP 主数据表 + 扩展 rfi_groundfields 结构以支持 ITP 分级与 JSON 字段

CREATE TABLE IF NOT EXISTS `itp_definitions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `itp_no` VARCHAR(255) NOT NULL COMMENT 'ITP 编号，如 GCC-CC7-PM-00000-QC-PLN-00301',
  `itp_name` VARCHAR(255) NOT NULL COMMENT 'ITP 名称，如 Inspection and test plan for civil and erection works',
  `version` VARCHAR(50) NULL COMMENT '版本号，例如 1.0',
  `status` VARCHAR(50) NOT NULL DEFAULT 'active' COMMENT '状态: active / inactive / draft',
  `remarks` TEXT NULL COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT NULL,
  `updated_by` INT NULL,

  UNIQUE KEY `uk_itp_no` (`itp_no`),
  INDEX `idx_itp_status` (`status`),
  CONSTRAINT `fk_itp_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_itp_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


ALTER TABLE `rfi_groundfields`
  ADD COLUMN `itp_id` INT NULL COMMENT '所属 ITP 定义ID' AFTER `id`,
  ADD COLUMN `level` TINYINT NULL COMMENT '层级: 2=大节, 3=检查项' AFTER `itp_id`,
  ADD COLUMN `parent_id` INT NULL COMMENT '父节点ID（指向 rfi_groundfields.id，用于层级结构）' AFTER `level`,
  ADD COLUMN `section_name` VARCHAR(255) NULL COMMENT 'Level2: 大节标题' AFTER `description`,
  ADD COLUMN `no` VARCHAR(50) NULL COMMENT 'Level3: 行号，如 1.1, 1.2' AFTER `section_name`,
  ADD COLUMN `workdescription` TEXT NULL COMMENT 'Level2/3: 工作描述' AFTER `no`,
  ADD COLUMN `applicable_documents` JSON NULL COMMENT 'Level3: 适用文件(JSON数组)' AFTER `workdescription`,
  ADD COLUMN `acceptance_criteria` JSON NULL COMMENT 'Level3: 验收准则(JSON数组)' AFTER `applicable_documents`,
  ADD COLUMN `quality_control_form` VARCHAR(255) NULL COMMENT 'Level3: 质量控制表/记录表' AFTER `acceptance_criteria`,
  ADD COLUMN `master_document` VARCHAR(255) NULL COMMENT 'Level3: Master document' AFTER `quality_control_form`,
  ADD COLUMN `involvement_subcon` VARCHAR(10) NULL COMMENT '分包商参与 P/R/S' AFTER `master_document`,
  ADD COLUMN `involvement_contractor` VARCHAR(10) NULL COMMENT '总包参与 P/R/S' AFTER `involvement_subcon`,
  ADD COLUMN `involvement_customer` VARCHAR(10) NULL COMMENT '客户/业主参与 P/R/S' AFTER `involvement_contractor`,
  ADD COLUMN `involvement_aqc` VARCHAR(10) NULL COMMENT 'AQC 参与 P/R/S' AFTER `involvement_customer`,
  ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 COMMENT '同层级排序' AFTER `involvement_aqc`,
  ADD INDEX `idx_rfi_ground_itp_level` (`itp_id`, `level`, `sort_order`),
  ADD CONSTRAINT `fk_rfi_ground_itp` FOREIGN KEY (`itp_id`) REFERENCES `itp_definitions`(`id`),
  ADD CONSTRAINT `fk_rfi_ground_parent` FOREIGN KEY (`parent_id`) REFERENCES `rfi_groundfields`(`id`);

