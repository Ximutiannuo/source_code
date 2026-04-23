-- rfi_groundfields：section_name、description 改为 TEXT，以容纳长英俄双语标题（原 VARCHAR(255) 超长报错）
-- 执行后再运行 Word ITP 全量导入

ALTER TABLE `rfi_groundfields`
  MODIFY COLUMN `section_name` TEXT NULL COMMENT 'Level2: 大节标题（英俄一体，可为长文本）',
  MODIFY COLUMN `description` TEXT NULL COMMENT '简要描述（用于下拉显示，可为 ITP 全名等长文本）';
