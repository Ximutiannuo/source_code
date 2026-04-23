-- ============================================
-- 新增六个角色数据库账号（对应 planner / planning_supervisor 的层级）
-- QAQC、质量主管；施工管理、施工主管；采购管理、采购主管
-- 密码默认：cc7@1234
-- ============================================
-- 执行前请用 root 或有 CREATE USER 权限的账号登录
-- mysql -u root -p < create_role_accounts_qaqc_construction_procurement.sql
-- ============================================

-- 1. 创建用户（'%' 与 'localhost' 与现有角色脚本一致）
CREATE USER IF NOT EXISTS 'role_qaqc'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_qaqc'@'localhost' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_qaqc_supervisor'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_qaqc_supervisor'@'localhost' IDENTIFIED BY 'cc7@1234';

CREATE USER IF NOT EXISTS 'role_construction'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_construction'@'localhost' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_construction_supervisor'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_construction_supervisor'@'localhost' IDENTIFIED BY 'cc7@1234';

CREATE USER IF NOT EXISTS 'role_procurement'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_procurement'@'localhost' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_procurement_supervisor'@'%' IDENTIFIED BY 'cc7@1234';
CREATE USER IF NOT EXISTS 'role_procurement_supervisor'@'localhost' IDENTIFIED BY 'cc7@1234';

-- 2. 授予权限（与 role_planner / role_planning_supervisor 一致：projectcontrols 读写，PRECOMCONTROL 只读）
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_qaqc'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_qaqc'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_qaqc'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_qaqc'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_qaqc_supervisor'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_qaqc_supervisor'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_qaqc_supervisor'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_qaqc_supervisor'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_construction'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_construction'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_construction'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_construction'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_construction_supervisor'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_construction_supervisor'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_construction_supervisor'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_construction_supervisor'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_procurement'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_procurement'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_procurement'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_procurement'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_procurement_supervisor'@'%';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_procurement_supervisor'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON `projectcontrols`.* TO 'role_procurement_supervisor'@'localhost';
GRANT SELECT ON `PRECOMCONTROL`.* TO 'role_procurement_supervisor'@'localhost';

-- 3. 刷新权限
FLUSH PRIVILEGES;

-- 验证（可选）：
-- SELECT User, Host FROM mysql.user WHERE User LIKE 'role_qaqc%' OR User LIKE 'role_construction%' OR User LIKE 'role_procurement%';
