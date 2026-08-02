BEGIN;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sale_mode VARCHAR(20) NOT NULL DEFAULT 'IMMEDIATE',
  ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(30) NOT NULL DEFAULT 'FULFILLED',
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pickup_token VARCHAR(120),
  ADD COLUMN IF NOT EXISTS pickup_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS pickup_site_id UUID REFERENCES sites(site_id),
  ADD COLUMN IF NOT EXISTS expected_pickup_date DATE,
  ADD COLUMN IF NOT EXISTS last_fulfillment_at TIMESTAMP;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT sales_sale_mode_chk
      CHECK (sale_mode IN ('IMMEDIATE', 'ADVANCE'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sales
    ADD CONSTRAINT sales_fulfillment_status_chk
      CHECK (fulfillment_status IN ('NOT_FULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_pickup_number_tenant
  ON sales(tenant_id, pickup_number)
  WHERE pickup_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_pickup_token_tenant
  ON sales(tenant_id, pickup_token)
  WHERE pickup_token IS NOT NULL;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS ordered_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfilled_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_unit_snapshot VARCHAR(120),
  ADD COLUMN IF NOT EXISTS packaging_snapshot VARCHAR(150);

ALTER TABLE sale_items
  ALTER COLUMN lot_id DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE sale_items
    ADD CONSTRAINT sale_items_quantity_chk
      CHECK (quantity > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sale_fulfillments (
  fulfillment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  site_id UUID NOT NULL REFERENCES sites(site_id),
  sale_id UUID NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
  fulfillment_number VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING', 'PARTIALLY_FULFILLED', 'COMPLETED', 'CANCELLED')),
  fulfilled_by UUID REFERENCES users(user_id),
  fulfilled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  recipient_name VARCHAR(200),
  recipient_document VARCHAR(120),
  cash_session_id UUID REFERENCES cash_sessions(cash_session_id),
  request_key VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_fulfillment_items (
  fulfillment_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fulfillment_id UUID NOT NULL REFERENCES sale_fulfillments(fulfillment_id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(sale_item_id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(article_id),
  lot_id UUID REFERENCES lots(lot_id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_snapshot VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_fulfillments_number_tenant
  ON sale_fulfillments(tenant_id, fulfillment_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_fulfillments_request_key
  ON sale_fulfillments(tenant_id, request_key)
  WHERE request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sale_fulfillments_sale
  ON sale_fulfillments(tenant_id, sale_id, fulfilled_at DESC);

COMMIT;
