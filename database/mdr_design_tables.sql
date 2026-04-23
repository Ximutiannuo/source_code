-- MDR设计管理相关表 (根据 ENGDB 真实字段调整)

-- 1. 当前周设计数据表
CREATE TABLE IF NOT EXISTS `ext_eng_db_current` (
    `id` INT PRIMARY KEY,
    `document_key` VARCHAR(255),
    `dwg_status` VARCHAR(255),
    `contract_code` VARCHAR(255),
    `originator_code` VARCHAR(255),
    `subclass` VARCHAR(255),
    `discipline` VARCHAR(255),
    `facility` VARCHAR(255),
    `subtitle` VARCHAR(255),
    `marka_code` VARCHAR(255),
    `cia_code` VARCHAR(255),
    `document_type` VARCHAR(255),
    `document_serial_number` VARCHAR(255),
    `document_number` VARCHAR(255),
    `document_title` VARCHAR(255),
    `document_class` VARCHAR(255),
    `document_language` VARCHAR(255),
    `payment_milestone_id` VARCHAR(255),
    `subcontractor_responsible` VARCHAR(255),
    `contractor_responsible` VARCHAR(255),
    `schedule_activity_id` VARCHAR(255),
    `progress_plan` VARCHAR(255),
    `progress_actual` VARCHAR(255),
    `access_code` VARCHAR(255),
    `phase` VARCHAR(255),
    `package` VARCHAR(255),
    `notes` VARCHAR(255),
    `type_of_document` VARCHAR(255),
    `type_of_dates` VARCHAR(255),
    `dates` DATE,
    `review_code` VARCHAR(255),
    -- 系统生成的计算字段
    `calculated_block` VARCHAR(100),
    INDEX `idx_block_marka` (`calculated_block`, `marka_code`),
    INDEX `idx_document_number` (`document_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 上周设计数据表 (字段完全镜像)
CREATE TABLE IF NOT EXISTS `ext_eng_db_previous` (
    `id` INT PRIMARY KEY,
    `document_key` VARCHAR(255),
    `dwg_status` VARCHAR(255),
    `contract_code` VARCHAR(255),
    `originator_code` VARCHAR(255),
    `subclass` VARCHAR(255),
    `discipline` VARCHAR(255),
    `facility` VARCHAR(255),
    `subtitle` VARCHAR(255),
    `marka_code` VARCHAR(255),
    `cia_code` VARCHAR(255),
    `document_type` VARCHAR(255),
    `document_serial_number` VARCHAR(255),
    `document_number` VARCHAR(255),
    `document_title` VARCHAR(255),
    `document_class` VARCHAR(255),
    `document_language` VARCHAR(255),
    `payment_milestone_id` VARCHAR(255),
    `subcontractor_responsible` VARCHAR(255),
    `contractor_responsible` VARCHAR(255),
    `schedule_activity_id` VARCHAR(255),
    `progress_plan` VARCHAR(255),
    `progress_actual` VARCHAR(255),
    `access_code` VARCHAR(255),
    `phase` VARCHAR(255),
    `package` VARCHAR(255),
    `notes` VARCHAR(255),
    `type_of_document` VARCHAR(255),
    `type_of_dates` VARCHAR(255),
    `dates` DATE,
    `review_code` VARCHAR(255),
    `calculated_block` VARCHAR(100),
    INDEX `idx_block_marka` (`calculated_block`, `marka_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 同步日志表
CREATE TABLE IF NOT EXISTS `mdr_sync_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sync_time` DATETIME NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `total_count` INT DEFAULT 0,
    `message` TEXT,
    `duration_seconds` INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 汇总分析历史表 (暂时保持这些字段用于统计)
CREATE TABLE IF NOT EXISTS `mdr_analysis_summary` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `analysis_date` DATE NOT NULL,
    `originator_code` VARCHAR(255),
    `discipline` VARCHAR(255),
    `total_dwg` INT DEFAULT 0,
    `finished_dwg` INT DEFAULT 0,
    INDEX `idx_date` (`analysis_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;