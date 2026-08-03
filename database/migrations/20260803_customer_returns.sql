BEGIN;

INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
VALUES
  ('customer_returns.read', 'Consulter retours clients', 'Sales', 'Voir les retours clients et leurs dossiers', TRUE),
  ('customer_returns.create', 'Creer retour client', 'Sales', 'Creer un brouillon de retour client depuis une vente validee', TRUE),
  ('customer_returns.inspect', 'Inspecter retour client', 'Sales', 'Enregistrer la decision d inspection du retour client', TRUE),
  ('customer_returns.validate', 'Valider retour client', 'Sales', 'Valider un retour client inspecte', TRUE),
  ('customer_returns.cancel', 'Annuler retour client', 'Sales', 'Annuler un retour client brouillon ou en inspection', TRUE),
  ('customer_return_attachments.read', 'Consulter pieces jointes retour client', 'Sales', 'Voir les pieces jointes des retours clients', TRUE),
  ('customer_return_attachments.create', 'Ajouter piece jointe retour client', 'Sales', 'Ajouter une piece jointe sur un retour client', TRUE),
  ('customer_return_attachments.delete', 'Supprimer piece jointe retour client', 'Sales', 'Supprimer logiquement une piece jointe de retour client', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = EXCLUDED.is_system_permission;

CREATE TABLE IF NOT EXISTS customer_returns (
  customer_return_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(site_id),
  sale_id UUID NOT NULL REFERENCES sales(sale_id),
  customer_id UUID REFERENCES customers(customer_id),
  organization_id UUID REFERENCES organizations(organization_id),
  membership_id UUID REFERENCES customer_memberships(membership_id),
  return_number VARCHAR(80) NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_number_snapshot VARCHAR(80) NOT NULL,
  sale_date_snapshot DATE NOT NULL,
  sale_type_snapshot VARCHAR(30) NOT NULL,
  customer_name_snapshot VARCHAR(255),
  organization_name_snapshot VARCHAR(255),
  site_name_snapshot VARCHAR(255) NOT NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
  exchange_rate_snapshot NUMERIC(14,4) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PENDING_INSPECTION', 'APPROVED', 'REJECTED', 'VALIDATED', 'CANCELLED')),
  reason TEXT,
  note TEXT,
  inspection_note TEXT,
  created_by UUID REFERENCES users(user_id),
  inspected_by UUID REFERENCES users(user_id),
  inspected_at TIMESTAMP,
  validated_by UUID REFERENCES users(user_id),
  validated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_returns_number_per_tenant ON customer_returns(tenant_id, return_number);
CREATE INDEX IF NOT EXISTS idx_customer_returns_sale ON customer_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_customer ON customer_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_site ON customer_returns(site_id);
CREATE INDEX IF NOT EXISTS idx_customer_returns_status ON customer_returns(status);

CREATE TABLE IF NOT EXISTS customer_return_items (
  customer_return_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  customer_return_id UUID NOT NULL REFERENCES customer_returns(customer_return_id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(sale_id),
  sale_item_id UUID NOT NULL REFERENCES sale_items(sale_item_id),
  article_id UUID NOT NULL REFERENCES articles(article_id),
  lot_id UUID REFERENCES lots(lot_id),
  article_code_snapshot VARCHAR(50),
  commercial_name_snapshot VARCHAR(255),
  lot_number_snapshot VARCHAR(100),
  expiry_date_snapshot DATE,
  sale_quantity NUMERIC(14,3) NOT NULL CHECK (sale_quantity > 0),
  returned_quantity NUMERIC(14,3) NOT NULL CHECK (returned_quantity > 0),
  condition_status VARCHAR(30) NOT NULL DEFAULT 'GOOD'
    CHECK (condition_status IN ('GOOD', 'OPENED', 'DAMAGED', 'EXPIRED', 'WRONG_PRODUCT', 'OTHER')),
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_return_items_return_sale_item ON customer_return_items(customer_return_id, sale_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_return ON customer_return_items(customer_return_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_sale_item ON customer_return_items(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_article ON customer_return_items(article_id);
CREATE INDEX IF NOT EXISTS idx_customer_return_items_lot ON customer_return_items(lot_id);

ALTER TABLE purchase_attachments
  ADD COLUMN IF NOT EXISTS customer_return_id UUID;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'purchase_attachments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%attachment_scope%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE purchase_attachments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE purchase_attachments
  ADD CONSTRAINT purchase_attachments_attachment_scope_check
  CHECK (attachment_scope IN ('PURCHASE', 'PURCHASE_RETURN', 'CUSTOMER_RETURN'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_attachments_customer_return_fk'
      AND conrelid = 'purchase_attachments'::regclass
  ) THEN
    ALTER TABLE purchase_attachments
      ADD CONSTRAINT purchase_attachments_customer_return_fk
      FOREIGN KEY (customer_return_id) REFERENCES customer_returns(customer_return_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_attachments_customer_return ON purchase_attachments(customer_return_id);

WITH target_admin_roles AS (
  SELECT r.role_id
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code IN ('DEMO', 'PHARMACIE_DEMO', 'STAGING')
    AND r.role_name = 'ADMIN'
),
expected_permissions(permission_code) AS (
  VALUES
    ('customer_returns.read'),
    ('customer_returns.create'),
    ('customer_returns.inspect'),
    ('customer_returns.validate'),
    ('customer_returns.cancel'),
    ('customer_return_attachments.read'),
    ('customer_return_attachments.create'),
    ('customer_return_attachments.delete')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT tar.role_id, p.permission_id
FROM target_admin_roles tar
JOIN expected_permissions ep ON TRUE
JOIN permissions p ON p.permission_code = ep.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;

SELECT
  t.tenant_code,
  r.role_name,
  p.permission_code,
  EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.role_id
      AND rp.permission_id = p.permission_id
  ) AS attached_to_role
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.permission_id
JOIN roles r ON r.role_id = rp.role_id
JOIN tenants t ON t.tenant_id = r.tenant_id
WHERE p.permission_code IN (
  'customer_returns.read',
  'customer_returns.create',
  'customer_returns.inspect',
  'customer_returns.validate',
  'customer_returns.cancel',
  'customer_return_attachments.read',
  'customer_return_attachments.create',
  'customer_return_attachments.delete'
)
  AND t.tenant_code IN ('DEMO', 'PHARMACIE_DEMO', 'STAGING')
ORDER BY t.tenant_code, p.permission_code;
