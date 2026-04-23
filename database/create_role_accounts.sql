-- ============================================
-- 创建角色数据库账号SQL脚本
-- 为每个角色创建专属数据库账号，实现最小权限原则
-- ============================================

-- 注意：执行此脚本前请先用root账号登录MySQL
-- mysql -u root -p < create_role_accounts.sql

-- ============================================
-- 1. 创建角色数据库账号
-- ============================================

-- 计划经理账号
CREATE USER IF NOT EXISTS 'role_planning_manager'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_planning_manager'@'localhost' IDENTIFIED BY 'cc7@1234';

-- 系统管理员账号
CREATE USER IF NOT EXISTS 'role_system_admin'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_system_admin'@'localhost' IDENTIFIED BY 'cc7@1234';

-- 计划主管账号
CREATE USER IF NOT EXISTS 'role_planning_supervisor'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_planning_supervisor'@'localhost' IDENTIFIED BY 'cc7@1234';

-- Planner账号（所有 Planner 角色共用此账号）
-- 注意：当前密码为 cc7@1234，生产环境必须修改！
CREATE USER IF NOT EXISTS 'role_planner'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_planner'@'localhost' IDENTIFIED BY 'cc7@1234';

-- ============================================
-- 2. 授予数据库访问权限（gcc.projectcontrols 和 gcc.proecomcontrol）
-- ============================================

-- 计划经理权限：可读写projectcontrols，只读PRECOMCONTROL
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_planning_manager'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_manager'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_planning_manager'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_manager'@'localhost';

-- 系统管理员权限：所有权限（类似root，但仅限这两个数据库）
GRANT ALL PRIVILEGES ON `projectcontrols`.* TO 'role_system_admin'@'%';
GRANT ALL PRIVILEGES ON `PRECOMCONTROL`.* TO 'role_system_admin'@'%';
GRANT ALL PRIVILEGES ON `projectcontrols`.* TO 'role_system_admin'@'localhost';
GRANT ALL PRIVILEGES ON `PRECOMCONTROL`.* TO 'role_system_admin'@'localhost';

-- 计划主管权限：可读写projectcontrols，只读PRECOMCONTROL
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_planning_supervisor'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_supervisor'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_planning_supervisor'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planning_supervisor'@'localhost';

-- Planner权限：可读写projectcontrols，只读PRECOMCONTROL
-- 注意：需要 CREATE, INDEX, ALTER, REFERENCES 权限以支持：
-- 1. 应用启动时的表创建（Base.metadata.create_all，虽然通常表已存在）
-- 2. 模型中的索引定义（多个 Index 在 __table_args__ 中）
-- 3. 外键约束（ForeignKey 需要 REFERENCES 权限）
-- 虽然这些 DDL 操作在生产环境通常不会执行，但作为安全边界必须授予
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_planner'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planner'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_planner'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_planner'@'localhost';

-- ============================================
-- 3. 刷新权限
-- ============================================
FLUSH PRIVILEGES;

-- ============================================
-- 4. 验证账号创建（可选，查看结果）
-- ============================================
-- SELECT User, Host FROM mysql.user WHERE User LIKE 'role_%';

-- ============================================
-- 使用说明：
-- 1. 执行此脚本前，请修改所有密码（当前为 cc7@1234，生产环境必须修改！）
-- 2. 将密码配置到 HashiCorp Vault（推荐）或环境变量（备选）
--    
--    推荐：使用 HashiCorp Vault
--    - 运行 backend/scripts/setup_vault.ps1 存储密码
--    - 设置 VAULT_ADDR 和 VAULT_TOKEN 环境变量
--    
--    备选：使用环境变量（仅临时方案）
--    - Windows: [System.Environment]::SetEnvironmentVariable('ROLE_PLANNER_PASSWORD', 'your_password', 'Machine')
--    - Linux: export ROLE_PLANNER_PASSWORD='your_password'
--    
-- 3. 详细配置指南：backend/docs/DATABASE_ACCOUNT_MANAGEMENT.md
-- 4. 建议定期审查和更新密码
-- 5. 执行完成后，验证账号创建：
--    SELECT User, Host FROM mysql.user WHERE User LIKE 'role_%';
--    SHOW GRANTS FOR 'role_planner'@'%';
-- ============================================
