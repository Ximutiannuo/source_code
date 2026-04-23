-- ============================================
-- 检查并修复 MySQL 密码验证问题
-- ============================================

-- 1. 检查当前用户的认证插件
SELECT User, Host, plugin, authentication_string IS NOT NULL as has_password 
FROM mysql.user 
WHERE User LIKE 'role_%';

-- 2. 如果使用的是 caching_sha2_password，可能需要改为 mysql_native_password
-- 或者确保密码正确设置

-- 3. 强制更新密码（使用 mysql_native_password 插件，兼容性更好）
ALTER USER 'role_planning_manager'@'localhost' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';
ALTER USER 'role_planning_manager'@'%' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';

ALTER USER 'role_system_admin'@'localhost' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';
ALTER USER 'role_system_admin'@'%' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';

ALTER USER 'role_planning_supervisor'@'localhost' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';
ALTER USER 'role_planning_supervisor'@'%' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';

ALTER USER 'role_planner'@'localhost' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';
ALTER USER 'role_planner'@'%' IDENTIFIED WITH mysql_native_password BY 'cc7@1234';

-- 4. 刷新权限
FLUSH PRIVILEGES;

-- 5. 再次检查
SELECT User, Host, plugin, authentication_string IS NOT NULL as has_password 
FROM mysql.user 
WHERE User LIKE 'role_%';
