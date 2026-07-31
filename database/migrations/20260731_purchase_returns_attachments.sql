BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_movements_movement_type_check'
      AND conrelid = 'stock_movements'::regclass
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_movement_type_check;
  END IF;
END $$;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (
    movement_type IN (
      'PURCHASE_IN',
      'PURCHASE_RETURN_OUT',
      'PURCHASE_EXCHANGE_IN',
      'SALE_OUT',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'RETURN_IN',
      'RETURN_OUT',
      'EXPIRED_OUT',
      'INVENTORY_GAIN',
      'INVENTORY_LOSS'
    )
  );

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
      'CASH_IN',
      'CASH_OUT',
      'EXPENSE',
      'BANK_DEPOSIT',
      'ADVANCE',
      'ADJUSTMENT'
    )
  );

CREATE TABLE IF NOT EXISTS purchase_attachments (
  purchase_attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  site_id UUID REFERENCES sites(site_id),
  purchase_id UUID REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  purchase_return_id UUID,
  attachment_scope VARCHAR(30) NOT NULL DEFAULT 'PURCHASE'
    CHECK (attachment_scope IN ('PURCHASE', 'PURCHASE_RETURN')),
  attachment_type VARCHAR(40) NOT NULL DEFAULT 'OTHER'
    CHECK (attachment_type IN ('INVOICE', 'DELIVERY_NOTE', 'RECEIPT', 'PAYMENT_PROOF', 'PRODUCT_PHOTO', 'CUSTOMS_DOCUMENT', 'RETURN_NOTE', 'CREDIT_NOTE', 'OTHER')),
  file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  storage_bucket VARCHAR(100) NOT NULL DEFAULT 'purchase-attachments',
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  description TEXT,
  uploaded_by UUID REFERENCES users(user_id),
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(user_id),
  client_generated_id VARCHAR(120),
  sync_state VARCHAR(30)
);

CREATE INDEX IF NOT EXISTS idx_purchase_attachments_purchase ON purchase_attachments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_attachments_return ON purchase_attachments(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_attachments_tenant ON purchase_attachments(tenant_id);

CREATE TABLE IF NOT EXISTS purchase_returns (
  purchase_return_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  site_id UUID NOT NULL REFERENCES sites(site_id),
  purchase_id UUID NOT NULL REFERENCES purchases(purchase_id),
  supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
  return_number VARCHAR(80) NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_type VARCHAR(30) NOT NULL DEFAULT 'REFUND'
    CHECK (return_type IN ('REFUND', 'CREDIT_NOTE', 'EXCHANGE', 'MIXED')),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'VALIDATED', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED')),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(14,4) NOT NULL DEFAULT 1,
  returned_value_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  replacement_value_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  financial_difference_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_due_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  additional_payment_due_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  supplier_credit_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  refunded_amount_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  additional_paid_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  reason TEXT,
  note TEXT,
  created_by UUID REFERENCES users(user_id),
  validated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  client_generated_id VARCHAR(120),
  sync_state VARCHAR(30)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_returns_number_per_tenant ON purchase_returns(tenant_id, return_number);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON purchase_returns(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_site ON purchase_returns(site_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status ON purchase_returns(status);

ALTER TABLE purchase_attachments
  ADD CONSTRAINT purchase_attachments_purchase_return_fk
  FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(purchase_return_id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS purchase_return_items (
  purchase_return_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  purchase_return_id UUID NOT NULL REFERENCES purchase_returns(purchase_return_id) ON DELETE CASCADE,
  purchase_item_id UUID NOT NULL REFERENCES purchase_items(purchase_item_id),
  article_id UUID NOT NULL REFERENCES articles(article_id),
  lot_id UUID NOT NULL REFERENCES lots(lot_id),
  purchase_unit_id UUID REFERENCES product_units(product_unit_id),
  purchase_unit_label_snapshot VARCHAR(120),
  returned_purchase_quantity NUMERIC(14,3) NOT NULL CHECK (returned_purchase_quantity > 0),
  conversion_factor NUMERIC(14,6) NOT NULL CHECK (conversion_factor > 0),
  returned_stock_quantity NUMERIC(14,3) NOT NULL CHECK (returned_stock_quantity > 0),
  stock_unit_id UUID REFERENCES product_units(product_unit_id),
  stock_unit_label_snapshot VARCHAR(120),
  original_unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  return_unit_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_return_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  reason TEXT,
  condition_status VARCHAR(30) NOT NULL DEFAULT 'GOOD'
    CHECK (condition_status IN ('GOOD', 'DAMAGED', 'EXPIRED', 'NON_COMPLIANT', 'WRONG_PRODUCT', 'OTHER')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_purchase_item ON purchase_return_items(purchase_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_article ON purchase_return_items(article_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_lot ON purchase_return_items(lot_id);

CREATE TABLE IF NOT EXISTS purchase_return_replacement_items (
  purchase_return_replacement_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  purchase_return_id UUID NOT NULL REFERENCES purchase_returns(purchase_return_id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(article_id),
  purchase_unit_id UUID REFERENCES product_units(product_unit_id),
  purchase_unit_label_snapshot VARCHAR(120),
  received_purchase_quantity NUMERIC(14,3) NOT NULL CHECK (received_purchase_quantity > 0),
  conversion_factor NUMERIC(14,6) NOT NULL CHECK (conversion_factor > 0),
  received_stock_quantity NUMERIC(14,3) NOT NULL CHECK (received_stock_quantity > 0),
  stock_unit_id UUID REFERENCES product_units(product_unit_id),
  stock_unit_label_snapshot VARCHAR(120),
  lot_number VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  unit_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_return_replacements_return ON purchase_return_replacement_items(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_replacements_article ON purchase_return_replacement_items(article_id);

CREATE TABLE IF NOT EXISTS purchase_return_settlements (
  purchase_return_settlement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  site_id UUID NOT NULL REFERENCES sites(site_id),
  purchase_return_id UUID NOT NULL REFERENCES purchase_returns(purchase_return_id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
  settlement_kind VARCHAR(40) NOT NULL
    CHECK (settlement_kind IN ('REFUND', 'ADDITIONAL_PAYMENT', 'SUPPLIER_CREDIT')),
  payment_source VARCHAR(40) NOT NULL
    CHECK (payment_source IN ('CASH_REGISTER', 'BANK', 'MOBILE_MONEY', 'SUPPLIER_CREDIT', 'OTHER')),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  exchange_rate_applied NUMERIC(14,4) NOT NULL DEFAULT 1,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_equivalent_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  cash_session_id UUID REFERENCES cash_sessions(cash_session_id),
  reference VARCHAR(120),
  note TEXT,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_return_settlements_return ON purchase_return_settlements(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_settlements_supplier ON purchase_return_settlements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_settlements_cash_session ON purchase_return_settlements(cash_session_id);

CREATE TABLE IF NOT EXISTS supplier_credits (
  supplier_credit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  site_id UUID NOT NULL REFERENCES sites(site_id),
  supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
  purchase_return_id UUID NOT NULL REFERENCES purchase_returns(purchase_return_id),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount >= 0),
  remaining_amount NUMERIC(14,2) NOT NULL CHECK (remaining_amount >= 0),
  exchange_rate_applied NUMERIC(14,4) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'PARTIALLY_USED', 'USED', 'CANCELLED')),
  reference VARCHAR(120),
  note TEXT,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_credits_supplier ON supplier_credits(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_credits_return ON supplier_credits(purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_supplier_credits_status ON supplier_credits(status);

COMMIT;
