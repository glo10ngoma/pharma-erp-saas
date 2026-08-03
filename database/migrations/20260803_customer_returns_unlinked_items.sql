BEGIN;

ALTER TABLE customer_return_items
  ALTER COLUMN sale_id DROP NOT NULL,
  ALTER COLUMN sale_item_id DROP NOT NULL;

ALTER TABLE customer_return_items
  ADD COLUMN IF NOT EXISTS declared_lot_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS declared_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS declared_unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reason TEXT;

UPDATE customer_return_items
SET declared_unit_price = COALESCE(NULLIF(declared_unit_price, 0), unit_price_snapshot, 0)
WHERE declared_unit_price IS NULL OR declared_unit_price = 0;

COMMIT;

