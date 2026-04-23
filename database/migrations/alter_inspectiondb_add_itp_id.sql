-- 验收日报表关联 ITP 定义：增加 itp_id，与 itp_no 区分（itp_id=关联，itp_no=展示用编号）
-- 执行前请确保 itp_definitions 表已存在（见 alter_rfi_groundfields_add_itp.sql）

ALTER TABLE `inspectiondb`
  ADD COLUMN `itp_id` INT NULL COMMENT '关联 ITP 定义（itp_definitions.id）' AFTER `itp_no`,
  ADD INDEX `idx_inspectiondb_itp_id` (`itp_id`),
  ADD CONSTRAINT `fk_inspectiondb_itp` FOREIGN KEY (`itp_id`) REFERENCES `itp_definitions`(`id`);
