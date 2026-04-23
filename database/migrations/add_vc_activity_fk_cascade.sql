-- Add FK constraints from volume control tables to activity_summary
-- This migration removes orphaned rows to allow FK creation.

SET SQL_SAFE_UPDATES = 0;

START TRANSACTION;

-- Clean orphans (non-null activity_id that no longer exist in activity_summary)
DELETE vcq
FROM volume_control_quantity vcq
LEFT JOIN activity_summary a ON vcq.activity_id = a.activity_id
WHERE vcq.activity_id IS NOT NULL
  AND a.activity_id IS NULL
  AND vcq.id IS NOT NULL;

DELETE vci
FROM volume_control_inspection vci
LEFT JOIN activity_summary a ON vci.activity_id = a.activity_id
WHERE vci.activity_id IS NOT NULL
  AND a.activity_id IS NULL
  AND vci.id IS NOT NULL;

DELETE vca
FROM volume_control_asbuilt vca
LEFT JOIN activity_summary a ON vca.activity_id = a.activity_id
WHERE vca.activity_id IS NOT NULL
  AND a.activity_id IS NULL
  AND vca.id IS NOT NULL;

DELETE vcp
FROM volume_control_payment vcp
LEFT JOIN activity_summary a ON vcp.activity_id = a.activity_id
WHERE vcp.activity_id IS NOT NULL
  AND a.activity_id IS NULL
  AND vcp.id IS NOT NULL;

-- Add FK constraints (activity_id -> activity_summary.activity_id)
ALTER TABLE volume_control_quantity
  ADD CONSTRAINT fk_vcq_activity_id
  FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id)
  ON DELETE CASCADE;

ALTER TABLE volume_control_inspection
  ADD CONSTRAINT fk_vci_activity_id
  FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id)
  ON DELETE CASCADE;

ALTER TABLE volume_control_asbuilt
  ADD CONSTRAINT fk_vca_activity_id
  FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id)
  ON DELETE CASCADE;

ALTER TABLE volume_control_payment
  ADD CONSTRAINT fk_vcp_activity_id
  FOREIGN KEY (activity_id) REFERENCES activity_summary(activity_id)
  ON DELETE CASCADE;

COMMIT;

SET SQL_SAFE_UPDATES = 1;
