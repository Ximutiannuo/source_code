-- 创建 budgeted_db 表
-- 用于存储 P6 的预算/计划数据 (Time-distributed data)
CREATE TABLE IF NOT EXISTS budgeted_db (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id VARCHAR(100) NOT NULL COMMENT '关联 activity_summary.activity_id',
    block VARCHAR(100) COMMENT '关联 facilities.block',
    resource_id VARCHAR(100) COMMENT '关联 rsc_defines.resource_id',
    date DATE NOT NULL COMMENT '数据日期',
    budgeted_units DECIMAL(18, 2) DEFAULT 0 COMMENT '计划工时/工程量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_budgeted_activity (activity_id),
    INDEX idx_budgeted_date (date),
    INDEX idx_budgeted_resource (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 atcompletion_db 表
-- 用于存储 P6 的预测/完工数据 (Time-distributed data at completion)
CREATE TABLE IF NOT EXISTS atcompletion_db (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id VARCHAR(100) NOT NULL COMMENT '关联 activity_summary.activity_id',
    block VARCHAR(100) COMMENT '关联 facilities.block',
    resource_id VARCHAR(100) COMMENT '关联 rsc_defines.resource_id',
    date DATE NOT NULL COMMENT '数据日期',
    atcompletion_units DECIMAL(18, 2) DEFAULT 0 COMMENT '预测完工工时/工程量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_atcompletion_activity (activity_id),
    INDEX idx_atcompletion_date (date),
    INDEX idx_atcompletion_resource (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 owf_db 表
-- 用于存储实际进度值 (One Way Factor / Actual Progress)
-- 数据来源：Excel 导入或其他计算逻辑
CREATE TABLE IF NOT EXISTS owf_db (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id VARCHAR(100) NOT NULL COMMENT '关联 activity_summary.activity_id',
    resource_id VARCHAR(100) COMMENT '通常为 GCC_WF',
    date DATE NOT NULL COMMENT '数据日期',
    actual_units DECIMAL(18, 2) DEFAULT 0 COMMENT '实际完成值',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_owf_activity (activity_id),
    INDEX idx_owf_date (date),
    INDEX idx_owf_resource (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 project_info 表
-- 用于存储系统配置和项目基本信息
CREATE TABLE IF NOT EXISTS project_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL COMMENT '配置类别: Basic, HSE, Milestone, etc.',
    key_name VARCHAR(100) NOT NULL COMMENT '配置键名',
    value_content TEXT COMMENT '配置值',
    description VARCHAR(255) COMMENT '描述',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_project_info_key (category, key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建 project_images 表
-- 用于存储项目图片、现场照片，支持关联特定 ID 或日期
CREATE TABLE IF NOT EXISTS project_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL COMMENT '关联实体类型: Project, Activity, Site, etc.',
    entity_id VARCHAR(100) NOT NULL COMMENT '关联实体ID: P6 Project ID, Activity ID',
    image_url VARCHAR(255) NOT NULL COMMENT '图片路径或URL',
    title VARCHAR(100) COMMENT '图片标题',
    description TEXT COMMENT '图片描述/备注',
    taken_at DATE COMMENT '拍摄/上传对应日期',
    uploaded_by VARCHAR(100) COMMENT '上传者',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_images_entity (entity_type, entity_id),
    INDEX idx_images_date (taken_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入一些初始化项目信息 (示例)
INSERT INTO project_info (category, key_name, value_content, description) VALUES 
('Basic', 'ProjectName', '天然气化工综合体项目', '项目名称'),
('Basic', 'StartDate', '2021-04-01', '项目实际开工日期'),
('HSE', 'SafeManhours', '140000000', '累计安全人工时'),
('Milestone', 'MechanicalCompletion', '2027-06-30', '机械竣工日期')
ON DUPLICATE KEY UPDATE value_content = VALUES(value_content);
