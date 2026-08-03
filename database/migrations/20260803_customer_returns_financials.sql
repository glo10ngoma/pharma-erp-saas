BEGIN;

INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
VALUES
  ('customer_returns.exchange', 'Gerer echanges retour client', 'Sales', 'Ajouter les produits remis lors d un retour client', TRUE),
  ('customer_returns.refund', 'Regler retour client', 'Sales', 'Enregistrer un remboursement ou un complement sur un retour client', TRUE),
  ('customer_returns.credit', 'Creer avoir client', 'Sales', 'Creer un avoir client depuis un retour client', TRUE),
  ('customer_credits.read', 'Consulter avoirs clients', 'Sales', 'Voir les avoirs clients disponibles', TRUE),
  ('customer_credits.create', 'Creer avoir client', 'Sales', 'Creer un avoir client depuis un retour valide', TRUE),
  ('customer_credits.use', 'Utiliser avoir client', 'Sales', 'Utiliser un avoir client sur une vente ulterieure', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = EXCLUDED.is_system_permission;

ALTER TABLE customer_returns
  ADD COLUMN IF NOT EXISTS returned_value_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replacement_value_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_difference_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_due_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_payment_due_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_credit_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_paid_usd NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE customer_return_items
  ADD COLUMN IF NOT EXISTS unit_price_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_return_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_unit_snapshot VARCHAR(120),
  ADD COLUMN IF NOT EXISTS packaging_snapshot VARCHAR(120);

UPDATE customer_return_items cri
SET unit_price_snapshot = COALESCE(si.unit_price, 0),
    line_return_value = ROUND(COALESCE(cri.returned_quantity, 0) * COALESCE(si.unit_price, 0), 2),
    sales_unit_snapshot = COALESCE(cri.sales_unit_snapshot, si.sales_unit_snapshot),
    packaging_snapshot = COALESCE(cri.packaging_snapshot, si.packaging_snapshot)
FROM sale_items si
WHERE si.sale_item_id = cri.sale_item_id
  AND (cri.unit_price_snapshot = 0 OR cri.line_return_value = 0 OR cri.sales_unit_snapshot IS NULL OR cri.packaging_snapshot IS NULL);

CREATE TABLE IF NOT EXISTS customer_return_replacement_items (
  customer_return_replacement_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  customer_return_id UUID NOT NULL REFERENCES customer_returns(customer_return_id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(article_id),
  sales_unit_id UUID REFERENCES product_units(product_unit_id),
  sales_unit_snapshot VARCHAR(120),
  packaging_snapshot VARCHAR(120),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_return_replacements_return ON customer_return_replacement_items(customer_return_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_replacements_article ON customer_return_replacement_items(article_id);

CREATE TABLE IF NOT EXISTS customer_return_settlements (
  customer_return_settlement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(site_id),
  customer_return_id UUID NOT NULL REFERENCES customer_returns(customer_return_id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(customer_id),
  settlement_kind VARCHAR(40) NOT NULL
    CHECK (settlement_kind IN ('REFUND', 'ADDITIONAL_PAYMENT', 'CUSTOMER_CREDIT')),
  payment_source VARCHAR(40) NOT NULL
    CHECK (payment_source IN ('CASH_REGISTER', 'BANK', 'MOBILE_MONEY', 'CUSTOMER_CREDIT', 'OTHER')),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(14,4) NOT NULL DEFAULT 1,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_equivalent_usd NUMERIC(14,2) NOT NULL CHECK (amount_equivalent_usd > 0),
  cash_session_id UUID REFERENCES cash_sessions(cash_session_id),
  expiration_date DATE,
  reference VARCHAR(120),
  note TEXT,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_return_settlements_return ON customer_return_settlements(customer_return_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_settlements_customer ON customer_return_settlements(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_settlements_cash_session ON customer_return_settlements(cash_session_id);

ALTER TABLE customer_return_settlements
  ADD COLUMN IF NOT EXISTS expiration_date DATE;

CREATE TABLE IF NOT EXISTS customer_credits (
  customer_credit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(site_id),
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  customer_return_id UUID REFERENCES customer_returns(customer_return_id),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  initial_amount NUMERIC(14,2) NOT NULL CHECK (initial_amount > 0),
  remaining_amount NUMERIC(14,2) NOT NULL CHECK (remaining_amount >= 0),
  exchange_rate_applied NUMERIC(14,4) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'PARTIALLY_USED', 'USED', 'CANCELLED')),
  expiration_date DATE,
  reference VARCHAR(120),
  note TEXT,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_customer ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_return ON customer_credits(customer_return_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_status ON customer_credits(status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cash_movements_movement_type_check'
      AND conrelid = 'cash_movements'::regclass
  ) THEN
    ALTER TABLE cash_movements DROP CONSTRAINT cash_movements_movement_type_check;
  END IF;
END $$;

ALTER TABLE cash_movements
  ADD CONSTRAINT cash_movements_movement_type_check
  CHECK (
    movement_type IN (
      'SALE_PAYMENT',
      'SALE_CHANGE',
      'RECEIVABLE_PAYMENT',
      'PURCHASE_REFUND',
      'PURCHASE_EXCHANGE_PAYMENT',
      'CUSTOMER_REFUND',
      'CUSTOMER_EXCHANGE_PAYMENT',
      'CUSTOMER_CREDIT_CREATED',
      'CUSTOMER_CREDIT_USED',
      'CASH_IN',
      'CASH_OUT',
      'EXPENSE',
      'BANK_DEPOSIT',
      'ADVANCE',
      'ADJUSTMENT'
    )
  );

WITH target_admin_roles AS (
  SELECT r.role_id
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code IN ('DEMO', 'PHARMACIE_DEMO', 'STAGING')
    AND r.role_name = 'ADMIN'
),
expected_permissions(permission_code) AS (
  VALUES
    ('customer_returns.exchange'),
    ('customer_returns.refund'),
    ('customer_returns.credit'),
    ('customer_credits.read'),
    ('customer_credits.create'),
    ('customer_credits.use')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT tar.role_id, p.permission_id
FROM target_admin_roles tar
JOIN expected_permissions ep ON TRUE
JOIN permissions p ON p.permission_code = ep.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
