-- RFI 提交版本：质检拒绝后升版，用户下次上传 INPUT 使用该版本（_0, _1, _2...）
CREATE TABLE IF NOT EXISTS rfi_submission_version (
    scope VARCHAR(64) NOT NULL COMMENT '分包商 scope',
    rfi_id VARCHAR(255) NOT NULL COMMENT 'RFI 长代码',
    next_input_version INT NOT NULL DEFAULT 0 COMMENT '下次上传 INPUT 使用的版本号',
    PRIMARY KEY (scope, rfi_id)
) COMMENT='RFI 提交版本：拒绝即升版，等待用户重新上传';
