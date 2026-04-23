-- ============================================
-- 新增角色快速更新脚本
-- 用于快速添加新的 Planner 角色
-- ============================================
-- 
-- 使用方法：
-- 1. 修改下面的变量值（角色名称和描述）
-- 2. 在 MySQL 中执行此脚本
-- 
-- 注意：所有 Planner 角色共用 role_planner 数据库账号
-- 数据隔离通过应用层的 PermissionService.filter_by_permission() 实现

-- ============================================
-- 配置变量（请修改为实际值）
-- ============================================

SET @role_name = 'C20Planner';  -- 新角色名称
SET @role_description = 'C20计划，负责计划管理与日报填报。';  -- 角色描述

-- ============================================
-- 步骤 1：在 roles 表中创建角色
-- ============================================

INSERT INTO roles (name, description, is_active) 
VALUES (@role_name, @role_description, 1)
ON DUPLICATE KEY UPDATE 
    description = @role_description,
    is_active = 1;

SELECT @role_id := id FROM roles WHERE name = @role_name;

-- ============================================
-- 步骤 2：配置角色权限（示例：daily_report 和 planning 权限）
-- ============================================
-- 
-- 注意：需要根据实际需求配置权限范围
-- 下面示例为只能访问对应 scope 的数据（scope = 角色名去掉 'Planner'，例如 C20Planner -> C20）
-- 
-- 权限配置示例：
-- - daily_report:read (权限 ID 需要从 permissions 表查询)
-- - daily_report:create
-- - daily_report:update
-- - planning:read
-- 
-- 权限范围（scope）设置为角色名去掉 'Planner' 后缀
-- 例如：C20Planner -> scope = 'C20'
-- 

-- 获取权限 ID（根据实际权限代码调整）
SET @permission_daily_report_read = (SELECT id FROM permissions WHERE code = 'daily_report:read' LIMIT 1);
SET @permission_daily_report_create = (SELECT id FROM permissions WHERE code = 'daily_report:create' LIMIT 1);
SET @permission_daily_report_update = (SELECT id FROM permissions WHERE code = 'daily_report:update' LIMIT 1);
SET @permission_planning_read = (SELECT id FROM permissions WHERE code = 'planning:read' LIMIT 1);

-- 提取 scope（例如：C20Planner -> C20）
SET @scope = REPLACE(@role_name, 'Planner', '');

-- 插入权限配置（scope 设置为提取的值，其他字段为 NULL 表示无限制）
-- daily_report:read
INSERT INTO role_permissions (
    role_id, permission_id, scope, block, discipline, work_package,
    project, subproject, train, unit, main_block, quarter, simple_block, facility_id, resource_id
) VALUES (
    @role_id, @permission_daily_report_read, @scope, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
) ON DUPLICATE KEY UPDATE scope = @scope;

-- daily_report:create
INSERT INTO role_permissions (
    role_id, permission_id, scope, block, discipline, work_package,
    project, subproject, train, unit, main_block, quarter, simple_block, facility_id, resource_id
) VALUES (
    @role_id, @permission_daily_report_create, @scope, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
) ON DUPLICATE KEY UPDATE scope = @scope;

-- daily_report:update
INSERT INTO role_permissions (
    role_id, permission_id, scope, block, discipline, work_package,
    project, subproject, train, unit, main_block, quarter, simple_block, facility_id, resource_id
) VALUES (
    @role_id, @permission_daily_report_update, @scope, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
) ON DUPLICATE KEY UPDATE scope = @scope;

-- planning:read
INSERT INTO role_permissions (
    role_id, permission_id, scope, block, discipline, work_package,
    project, subproject, train, unit, main_block, quarter, simple_block, facility_id, resource_id
) VALUES (
    @role_id, @permission_planning_read, @scope, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
) ON DUPLICATE KEY UPDATE scope = @scope;

-- ============================================
-- 步骤 3：验证结果
-- ============================================

SELECT '角色创建完成' AS status;
SELECT id, name, description, is_active FROM roles WHERE name = @role_name;

SELECT '权限配置完成' AS status;
SELECT 
    r.name AS role_name,
    p.code AS permission_code,
    p.name AS permission_name,
    rp.scope,
    rp.block,
    rp.discipline,
    rp.work_package
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = @role_name;

-- ============================================
-- 下一步操作：
-- ============================================
-- 1. 将用户关联到新角色：
--    INSERT INTO user_roles (user_id, role_id) VALUES (用户ID, @role_id);
-- 
-- 2. 验证用户角色关联：
--    SELECT u.username, r.name 
--    FROM users u
--    JOIN user_roles ur ON u.id = ur.user_id
--    JOIN roles r ON ur.role_id = r.id
--    WHERE r.name = @role_name;
-- 
-- 3. 测试应用：使用新角色的用户登录，验证权限是否正常
-- 
-- 注意：无需配置数据库账号（所有 Planner 共用 role_planner 账号）
-- 数据隔离通过应用层的 PermissionService.filter_by_permission() 实现
-- 
-- 详细文档：backend/docs/DATABASE_ACCOUNT_MANAGEMENT.md
-- ============================================
