-- 删除不再使用的列，并将 quality_control_form_* 重命名为 quality_control_form_master_document_*，删除 master_document
-- 执行前需已执行 alter_rfi_groundfields_multilang.sql

-- 若某列已不存在可注释对应一行后执行
ALTER TABLE `rfi_groundfields`
  DROP COLUMN `workdescription`,
  DROP COLUMN `applicable_documents`,
  DROP COLUMN `acceptance_criteria`,
  DROP COLUMN `quality_control_form`,
  DROP COLUMN `master_document`;

-- MySQL 重命名列
ALTER TABLE `rfi_groundfields`
  CHANGE COLUMN `quality_control_form_eng` `quality_control_form_master_document_eng` VARCHAR(500) NULL COMMENT '质量控制表/主控文件-英文',
  CHANGE COLUMN `quality_control_form_rus` `quality_control_form_master_document_rus` VARCHAR(500) NULL COMMENT '质量控制表/主控文件-俄文',
  CHANGE COLUMN `quality_control_form_chn` `quality_control_form_master_document_chn` VARCHAR(500) NULL COMMENT '质量控制表/主控文件-中文';
