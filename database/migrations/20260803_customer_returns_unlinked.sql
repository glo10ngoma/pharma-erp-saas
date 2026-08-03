BEGIN;

INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
VALUES
  ('customer_returns.unlinked.create', 'Creer retour sans facture', 'Sales', 'Creer un retour client exceptionnel sans vente identifiee', TRUE),
  ('customer_returns.unlinked.approve', 'Approuver retour sans facture', 'Sales', 'Approuver un retour client sans facture apres controle responsable', TRUE),
  ('customer_returns.traceability.review', 'Revoir tracabilite retour', 'Sales', 'Consulter et reviser le controle de tracabilite des retours clients', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = EXCLUDED.is_system_permission;

ALTER TABLE customer_returns
  ALTER COLUMN sale_id DROP NOT NULL,
  ALTER COLUMN sale_number_snapshot DROP NOT NULL,
  ALTER COLUMN sale_date_snapshot DROP NOT NULL,
  ALTER COLUMN sale_type_snapshot DROP NOT NULL;

ALTER TABLE customer_returns
  ADD COLUMN IF NOT EXISTS sale_link_status VARCHAR(30) NOT NULL DEFAULT 'LINKED',
  ADD COLUMN IF NOT EXISTS traceability_status VARCHAR(30) NOT NULL DEFAULT 'STRONG',
  ADD COLUMN IF NOT EXISTS probable_sale_id UUID REFERENCES sales(sale_id),
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS created_without_sale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_without_sale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS declared_customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS declared_customer_phone VARCHAR(80),
  ADD COLUMN IF NOT EXISTS declared_article_id UUID REFERENCES articles(article_id),
  ADD COLUMN IF NOT EXISTS declared_article_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS declared_quantity NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS declared_lot_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS declared_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS approximate_purchase_date DATE,
  ADD COLUMN IF NOT EXISTS supposed_site_id UUID REFERENCES sites(site_id),
  ADD COLUMN IF NOT EXISTS declared_price NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS responsibility_origin VARCHAR(40),
  ADD COLUMN IF NOT EXISTS commercial_decision VARCHAR(40),
  ADD COLUMN IF NOT EXISTS traceability_note TEXT;

UPDATE customer_returns
SET sale_link_status = CASE WHEN sale_id IS NULL THEN 'UNLINKED' ELSE 'LINKED' END,
    created_without_sale = COALESCE(created_without_sale, sale_id IS NULL),
    traceability_status = COALESCE(traceability_status, CASE WHEN sale_id IS NULL THEN 'NONE' ELSE 'STRONG' END),
    confidence_score = COALESCE(confidence_score, CASE WHEN sale_id IS NULL THEN 0 ELSE 100 END);

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'customer_returns'::regclass
    AND contype = 'c'
    AND conname = 'customer_returns_status_check';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE customer_returns DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE customer_returns
  ADD CONSTRAINT customer_returns_status_check
  CHECK (status IN (
    'DRAFT',
    'PENDING_TRACEABILITY',
    'PENDING_MANAGER_APPROVAL',
    'PENDING_INSPECTION',
    'APPROVED',
    'REJECTED',
    'VALIDATED',
    'CANCELLED'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_returns_sale_link_status_check'
      AND conrelid = 'customer_returns'::regclass
  ) THEN
    ALTER TABLE customer_returns
      ADD CONSTRAINT customer_returns_sale_link_status_check
      CHECK (sale_link_status IN ('LINKED', 'PROBABLE', 'UNLINKED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_returns_traceability_status_check'
      AND conrelid = 'customer_returns'::regclass
  ) THEN
    ALTER TABLE customer_returns
      ADD CONSTRAINT customer_returns_traceability_status_check
      CHECK (traceability_status IN ('STRONG', 'PARTIAL', 'WEAK', 'NONE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_returns_responsibility_origin_check'
      AND conrelid = 'customer_returns'::regclass
  ) THEN
    ALTER TABLE customer_returns
      ADD CONSTRAINT customer_returns_responsibility_origin_check
      CHECK (responsibility_origin IS NULL OR responsibility_origin IN ('PHARMACY_ERROR', 'CUSTOMER_ERROR', 'SUPPLIER_DEFECT', 'OTHER'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_returns_commercial_decision_check'
      AND conrelid = 'customer_returns'::regclass
  ) THEN
    ALTER TABLE customer_returns
      ADD CONSTRAINT customer_returns_commercial_decision_check
      CHECK (commercial_decision IS NULL OR commercial_decision IN ('ACCEPTED_WITH_RESERVE', 'REFUSED', 'INSPECTION_REQUIRED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_returns_sale_link_status ON customer_returns(sale_link_status);
CREATE INDEX IF NOT EXISTS idx_customer_returns_traceability_status ON customer_returns(traceability_status);
CREATE INDEX IF NOT EXISTS idx_customer_returns_probable_sale ON customer_returns(probable_sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_declared_article ON customer_returns(declared_article_id);

WITH target_admin_roles AS (
  SELECT r.role_id
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code IN ('DEMO', 'PHARMACIE_DEMO', 'STAGING')
    AND r.role_name = 'ADMIN'
),
expected_permissions(permission_code) AS (
  VALUES
    ('customer_returns.unlinked.create'),
    ('customer_returns.unlinked.approve'),
    ('customer_returns.traceability.review')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT tar.role_id, p.permission_id
FROM target_admin_roles tar
JOIN expected_permissions ep ON TRUE
JOIN permissions p ON p.permission_code = ep.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
