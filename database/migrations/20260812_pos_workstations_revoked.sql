BEGIN;

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT c.conname
  INTO existing_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'pos_workstations'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%offline_status%';

  IF existing_constraint IS NOT NULL AND existing_constraint <> 'chk_pos_workstations_offline_status' THEN
    EXECUTE format('ALTER TABLE pos_workstations DROP CONSTRAINT IF EXISTS %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE pos_workstations
  DROP CONSTRAINT IF EXISTS chk_pos_workstations_offline_status;

ALTER TABLE pos_workstations
  ADD CONSTRAINT chk_pos_workstations_offline_status
  CHECK (offline_status IN ('ONLINE', 'OFFLINE_READY', 'OFFLINE_PENDING', 'REVOKED'));

ALTER TABLE pos_workstations
  DROP CONSTRAINT IF EXISTS pos_workstations_sync_state_check;

ALTER TABLE pos_workstations
  ADD CONSTRAINT pos_workstations_sync_state_check
  CHECK (sync_state IN ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR', 'REVOKED'));

COMMIT;
