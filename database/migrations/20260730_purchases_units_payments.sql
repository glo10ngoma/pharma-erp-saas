ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS payment_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40),
  ADD COLUMN IF NOT EXISTS total_equivalent_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_equivalent_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_balance_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(cash_session_id),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120),
  ADD COLUMN IF NOT EXISTS payment_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchases_payment_status_check'
      AND conrelid = 'purchases'::regclass
  ) THEN
    ALTER TABLE purchases
      ADD CONSTRAINT purchases_payment_status_check
      CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID'));
  END IF;
END $$;

ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS purchase_unit_id UUID REFERENCES product_units(product_unit_id),
  ADD COLUMN IF NOT EXISTS purchase_unit_label_snapshot VARCHAR(120),
  ADD COLUMN IF NOT EXISTS purchase_quantity NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS stock_unit_id UUID REFERENCES product_units(product_unit_id),
  ADD COLUMN IF NOT EXISTS stock_unit_label_snapshot VARCHAR(120),
  ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS unit_price_currency VARCHAR(10),
  ADD COLUMN IF NOT EXISTS line_total_currency NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS line_order INTEGER;

UPDATE purchase_items
SET purchase_quantity = COALESCE(purchase_quantity, quantity),
    conversion_factor = COALESCE(conversion_factor, 1),
    stock_quantity = COALESCE(stock_quantity, quantity),
    line_total_currency = COALESCE(line_total_currency, line_total),
    line_order = COALESCE(line_order, 0)
WHERE purchase_quantity IS NULL
   OR conversion_factor IS NULL
   OR stock_quantity IS NULL
   OR line_total_currency IS NULL
   OR line_order IS NULL;

CREATE TABLE IF NOT EXISTS purchase_payments (
  purchase_payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  site_id UUID NOT NULL REFERENCES sites(site_id),
  purchase_id UUID NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  cash_session_id UUID REFERENCES cash_sessions(cash_session_id),
  currency_id UUID REFERENCES currencies(currency_id),
  currency_code VARCHAR(10) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  exchange_rate_applied NUMERIC(14,4) NOT NULL DEFAULT 1,
  amount_equivalent_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_source VARCHAR(40) NOT NULL,
  payment_method VARCHAR(40),
  payment_reference VARCHAR(120),
  payment_note TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'POSTED',
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON purchase_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_tenant ON purchase_payments(tenant_id);
