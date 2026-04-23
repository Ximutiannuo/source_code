-- 可选：加速 DDD 统计刷新（_run_ddd_stats_cache 对 ext_eng_db_current 的单次聚合）。
-- 约 300 万行时，以下索引可缩短刷新时间；若已存在同名索引则跳过。
-- 执行前请确认 ext_eng_db_current 已存在（由 MDR 同步使用）。

-- 过滤条件 (dwg_status, document_number) 便于 WHERE 使用
ALTER TABLE ext_eng_db_current ADD INDEX idx_ddd_dwg_doc (dwg_status(32), document_number(64));

-- 若 type_of_document/type_of_dates 条件常被用到，可再加（按需取消注释）
-- ALTER TABLE ext_eng_db_current ADD INDEX idx_ddd_type (type_of_document(32), type_of_dates(64));
