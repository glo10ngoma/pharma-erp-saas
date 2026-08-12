BEGIN;

CREATE TABLE IF NOT EXISTS pos_workstation_status (
  workstation_status_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  workstation_id uuid NOT NULL REFERENCES pos_workstations(workstation_id) ON DELETE CASCADE,
  device_id varchar(150) NULL,
  user_id uuid NULL REFERENCES users(user_id) ON DELETE SET NULL,
  app_version varchar(80) NULL,
  local_db_version varchar(80) NULL,
  sync_cursor varchar(255) NULL,
  pending_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  snapshot_status varchar(30) NOT NULL DEFAULT 'UNKNOWN',
  last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sync_at timestamptz NULL,
  last_successful_sync_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pos_workstation_status_workstation UNIQUE (workstation_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_workstation_status_tenant
  ON pos_workstation_status (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_workstation_status_site
  ON pos_workstation_status (site_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_workstation_status_last_seen
  ON pos_workstation_status (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS pos_sync_conflicts (
  conflict_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES sites(site_id) ON DELETE SET NULL,
  workstation_id uuid NULL REFERENCES pos_workstations(workstation_id) ON DELETE SET NULL,
  operation_id uuid NOT NULL,
  local_sale_id uuid NULL,
  offline_reference varchar(120) NULL,
  conflict_code varchar(80) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'OPEN',
  severity varchar(20) NOT NULL DEFAULT 'WARNING',
  message text NOT NULL,
  local_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  server_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_type varchar(60) NULL,
  resolution_payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at timestamptz NULL,
  resolved_by uuid NULL REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_sync_conflicts_tenant_operation
  ON pos_sync_conflicts (tenant_id, operation_id);

CREATE INDEX IF NOT EXISTS idx_pos_sync_conflicts_status
  ON pos_sync_conflicts (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_sync_conflicts_workstation
  ON pos_sync_conflicts (tenant_id, workstation_id, created_at DESC);

COMMIT;
