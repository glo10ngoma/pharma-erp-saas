CREATE TABLE IF NOT EXISTS purchase_number_counters (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO purchase_number_counters (tenant_id, last_number, updated_at)
SELECT
  t.tenant_id,
  COALESCE(MAX(substring(p.purchase_number from '^ACH-([0-9]+)$')::int), 0) AS last_number,
  CURRENT_TIMESTAMP
FROM tenants t
LEFT JOIN purchases p
  ON p.tenant_id = t.tenant_id
 AND p.purchase_number ~ '^ACH-[0-9]+$'
GROUP BY t.tenant_id
ON CONFLICT (tenant_id)
DO UPDATE SET
  last_number = GREATEST(purchase_number_counters.last_number, EXCLUDED.last_number),
  updated_at = CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.purchases'::regclass
      AND conname = 'purchases_purchase_number_key'
  ) THEN
    ALTER TABLE purchases DROP CONSTRAINT purchases_purchase_number_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_tenant_number
  ON purchases(tenant_id, purchase_number);
