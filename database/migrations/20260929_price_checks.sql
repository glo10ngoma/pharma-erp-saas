BEGIN;

INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
VALUES
  ('price_checks.read', 'Consulter verifications de prix', 'Sales', 'Voir l historique des verifications de prix', TRUE),
  ('price_checks.create', 'Creer verification de prix', 'Sales', 'Creer une estimation de prix sans vente ni reservation de stock', TRUE),
  ('price_checks.print', 'Imprimer verification de prix', 'Sales', 'Imprimer ou reimprimer un bordereau de prix', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = EXCLUDED.is_system_permission;

CREATE TABLE IF NOT EXISTS price_checks (
  price_check_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(site_id),
  check_number VARCHAR(80) NOT NULL,
  customer_id UUID REFERENCES customers(customer_id),
  customer_name VARCHAR(255),
  patient_name VARCHAR(255),
  phone VARCHAR(80),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1,
  subtotal_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('COMPLETED', 'ARCHIVED')),
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_checks_number_per_tenant
  ON price_checks(tenant_id, check_number);
CREATE INDEX IF NOT EXISTS idx_price_checks_tenant_site_created
  ON price_checks(tenant_id, site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_checks_customer
  ON price_checks(customer_id);

CREATE TABLE IF NOT EXISTS price_check_items (
  price_check_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  price_check_id UUID NOT NULL REFERENCES price_checks(price_check_id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(article_id),
  article_code_snapshot VARCHAR(80),
  article_name_snapshot VARCHAR(255) NOT NULL,
  requested_quantity NUMERIC(14,3) NOT NULL CHECK (requested_quantity > 0),
  unit_id UUID REFERENCES product_units(product_unit_id),
  unit_name_snapshot VARCHAR(120),
  unit_price NUMERIC(14,2),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  availability_status VARCHAR(30) NOT NULL
    CHECK (availability_status IN ('AVAILABLE', 'INSUFFICIENT_STOCK', 'UNAVAILABLE', 'UNREFERENCED')),
  available_quantity_snapshot NUMERIC(14,3) NOT NULL DEFAULT 0,
  manual_description TEXT,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_check_items_check
  ON price_check_items(price_check_id);
CREATE INDEX IF NOT EXISTS idx_price_check_items_article
  ON price_check_items(article_id);

WITH target_roles AS (
  SELECT DISTINCT r.role_id
  FROM roles r
  LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
  LEFT JOIN permissions existing_permission ON existing_permission.permission_id = rp.permission_id
  WHERE r.role_name IN ('ADMIN', 'SUPER_ADMIN')
     OR existing_permission.permission_code IN ('sales.create', 'sales.read')
),
expected_permissions(permission_code) AS (
  VALUES
    ('price_checks.read'),
    ('price_checks.create'),
    ('price_checks.print')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT target_roles.role_id, permissions.permission_id
FROM target_roles
JOIN expected_permissions ON TRUE
JOIN permissions ON permissions.permission_code = expected_permissions.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
