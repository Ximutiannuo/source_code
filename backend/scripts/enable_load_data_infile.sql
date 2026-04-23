-- ======================================================
-- 快速启用 LOAD DATA LOCAL INFILE 配置
-- ======================================================
-- 
-- 使用方法：
-- 1. 以管理员身份连接到MySQL:
--    mysql -u root -p
-- 2. 执行此文件:
--    source C:/Projects/ProjectControls/backend/scripts/enable_load_data_infile.sql
-- 或者直接在MySQL Workbench中运行此脚本
-- 
-- ======================================================

-- 步骤1: 检查当前配置
SELECT '=== 当前 local_infile 配置 ===' AS '';
SHOW GLOBAL VARIABLES LIKE 'local_infile';
SHOW VARIABLES LIKE 'local_infile';

-- 步骤2: 启用 local_infile（全局）
SELECT '=== 启用 local_infile ===' AS '';
SET GLOBAL local_infile = 1;

-- 步骤3: 验证配置
SELECT '=== 验证配置（应该显示 ON） ===' AS '';
SHOW GLOBAL VARIABLES LIKE 'local_infile';

-- 步骤4: 检查max_allowed_packet（建议至少512MB）
SELECT '=== 当前 max_allowed_packet ===' AS '';
SHOW VARIABLES LIKE 'max_allowed_packet';

-- 如果太小，可以增大（建议1GB）
-- SET GLOBAL max_allowed_packet = 1073741824;  -- 1GB

-- 步骤5: 检查其他性能参数
SELECT '=== 其他关键性能参数 ===' AS '';
SHOW VARIABLES WHERE 
    Variable_name IN (
        'innodb_buffer_pool_size',
        'innodb_flush_log_at_trx_commit',
        'innodb_log_file_size',
        'unique_checks',
        'foreign_key_checks'
    );

-- 步骤6: 创建测试表并测试 LOAD DATA
SELECT '=== 测试 LOAD DATA LOCAL INFILE ===' AS '';

-- 创建临时测试表
DROP TABLE IF EXISTS test_load_data;
CREATE TABLE test_load_data (
    id INT,
    name VARCHAR(100),
    created_at DATETIME
) ENGINE=InnoDB;

-- 注意：需要先创建测试CSV文件
-- 如果文件不存在，这个命令会失败（这是正常的）
-- 你可以跳过这个测试，直接运行同步脚本验证

-- LOAD DATA LOCAL INFILE 'C:/temp/test.csv'
-- INTO TABLE test_load_data
-- FIELDS TERMINATED BY '\t'
-- LINES TERMINATED BY '\n';

-- 清理测试表
DROP TABLE IF EXISTS test_load_data;

-- 完成提示
SELECT '=== 配置完成 ===' AS '';
SELECT 'local_infile 已启用！' AS 'Status';
SELECT '请重新连接数据库，然后运行同步脚本。' AS 'Next Step';
SELECT '如果遇到问题，请查看: scripts/启用LOAD_DATA_INFILE配置.md' AS 'Help';

-- ======================================================
-- 可选：永久配置（需要修改配置文件并重启MySQL）
-- ======================================================
-- 
-- Windows: 编辑 C:/ProgramData/MySQL/MySQL Server 8.0/my.ini
-- Linux: 编辑 /etc/my.cnf 或 /etc/mysql/my.cnf
-- 
-- 添加以下内容:
-- 
-- [mysqld]
-- local_infile = 1
-- max_allowed_packet = 1G
-- innodb_buffer_pool_size = 8G
-- innodb_flush_log_at_trx_commit = 2
-- 
-- [mysql]
-- local_infile = 1
-- 
-- 然后重启MySQL服务:
-- Windows: Restart-Service MySQL80
-- Linux: sudo systemctl restart mysql
-- 
-- ======================================================

