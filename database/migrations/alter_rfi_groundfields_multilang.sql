-- rfi_groundfields 多语言列：英/俄/中分列，便于原版 Word 导入及后续中文翻译
-- section_name 保持单列（英语俄语写在一起）；description 保留用于下拉，可取自 description_eng
-- 执行后可将旧列 workdescription / applicable_documents / acceptance_criteria / quality_control_form 逐步弃用

ALTER TABLE `rfi_groundfields`
  ADD COLUMN `workdescription_eng` TEXT NULL COMMENT '工作/检查项描述-英文' AFTER `workdescription`,
  ADD COLUMN `workdescription_rus` TEXT NULL COMMENT '工作/检查项描述-俄文' AFTER `workdescription_eng`,
  ADD COLUMN `workdescription_chn` TEXT NULL COMMENT '工作/检查项描述-中文（后续翻译）' AFTER `workdescription_rus`,
  ADD COLUMN `applicable_documents_eng` JSON NULL COMMENT '适用文件列表-英文' AFTER `applicable_documents`,
  ADD COLUMN `applicable_documents_rus` JSON NULL COMMENT '适用文件列表-俄文' AFTER `applicable_documents_eng`,
  ADD COLUMN `applicable_documents_chn` JSON NULL COMMENT '适用文件列表-中文' AFTER `applicable_documents_rus`,
  ADD COLUMN `acceptance_criteria_eng` JSON NULL COMMENT '验收准则列表-英文' AFTER `acceptance_criteria`,
  ADD COLUMN `acceptance_criteria_rus` JSON NULL COMMENT '验收准则列表-俄文' AFTER `acceptance_criteria_eng`,
  ADD COLUMN `acceptance_criteria_chn` JSON NULL COMMENT '验收准则列表-中文' AFTER `acceptance_criteria_rus`,
  ADD COLUMN `quality_control_form_eng` VARCHAR(500) NULL COMMENT '质量控制表/记录表-英文' AFTER `quality_control_form`,
  ADD COLUMN `quality_control_form_rus` VARCHAR(500) NULL COMMENT '质量控制表/记录表-俄文' AFTER `quality_control_form_eng`,
  ADD COLUMN `quality_control_form_chn` VARCHAR(500) NULL COMMENT '质量控制表/记录表-中文' AFTER `quality_control_form_rus`;

-- 可选：将已有数据的旧列回填到 _eng，便于过渡
-- UPDATE rfi_groundfields SET workdescription_eng = workdescription WHERE workdescription_eng IS NULL AND workdescription IS NOT NULL;
-- UPDATE rfi_groundfields SET applicable_documents_eng = applicable_documents WHERE applicable_documents_eng IS NULL AND applicable_documents IS NOT NULL;
-- UPDATE rfi_groundfields SET acceptance_criteria_eng = acceptance_criteria WHERE acceptance_criteria_eng IS NULL AND acceptance_criteria IS NOT NULL;
-- UPDATE rfi_groundfields SET quality_control_form_eng = quality_control_form WHERE quality_control_form_eng IS NULL AND quality_control_form IS NOT NULL;
