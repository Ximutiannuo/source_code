-- DDD 统计缓存表：仅 1 行，由 MDR 同步完成后或定时任务刷新，接口只读此表，避免对 ext_eng_db_current 300 万行做实时聚合。
CREATE TABLE IF NOT EXISTS `ddd_stats_cache` (
    `id` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '固定 1，单行',
    `total` INT UNSIGNED NOT NULL DEFAULT 0,
    `ifr` INT UNSIGNED NOT NULL DEFAULT 0,
    `ifc` INT UNSIGNED NOT NULL DEFAULT 0,
    `ifc_a` INT UNSIGNED NOT NULL DEFAULT 0,
    `mac_total` INT UNSIGNED NOT NULL DEFAULT 0,
    `mac_ifc_a` INT UNSIGNED NOT NULL DEFAULT 0,
    `kisto_total` INT UNSIGNED NOT NULL DEFAULT 0,
    `kisto_ifc_a` INT UNSIGNED NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 初始化一行
INSERT IGNORE INTO ddd_stats_cache (id, total, ifr, ifc, ifc_a, mac_total, mac_ifc_a, kisto_total, kisto_ifc_a)
VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0);

-- 说明：DDD 数据由 MDR 同步完成后自动刷新（_run_ddd_stats_cache）。
-- 若 ext_eng_db_current 约 300 万行，可执行 database/migrations/add_ext_eng_db_current_ddd_indexes.sql 以加速刷新。
