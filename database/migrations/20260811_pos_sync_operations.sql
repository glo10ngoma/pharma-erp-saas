BEGIN;

CREATE TABLE IF NOT EXISTS pos_sync_operations (
  pos_sync_operation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id uuid NULL REFERENCES sites(site_id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES users(user_id) ON DELETE SET NULL,
  operation_id uuid NOT NULL,
  local_sale_id uuid NOT NULL,
  operation_type varchar(50) NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'SYNCED',
  server_sale_id uuid NULL REFERENCES sales(sale_id) ON DELETE SET NULL,
  server_sale_number varchar(100) NULL,
  processed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_sync_operations_tenant_operation
  ON pos_sync_operations (tenant_id, operation_id);

CREATE INDEX IF NOT EXISTS ix_pos_sync_operations_tenant_processed
  ON pos_sync_operations (tenant_id, processed_at DESC);

COMMIT;
