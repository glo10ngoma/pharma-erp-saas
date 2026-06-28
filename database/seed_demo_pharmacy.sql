-- Seed demo realiste - Pharmacie Demo Kinshasa
-- Objectif: remplir un tenant demo avec produits, stock, ventes, caisse,
-- creances, inventaires et ecritures comptables minimales.
--
-- Idempotence: le script reconstruit uniquement les donnees transactionnelles
-- du tenant PHARMACIE_DEMO, puis upsert les donnees referentielles demo.
-- Aucun secret: le hash ci-dessous est un hash bcrypt de demonstration.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by UUID REFERENCES users(user_id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_key ON tenant_settings(tenant_id, setting_key);

CREATE TEMP TABLE demo_product_data (
  article_code TEXT,
  commercial_name TEXT,
  dci TEXT,
  dosage TEXT,
  category_code TEXT,
  category_name TEXT,
  sub_category_code TEXT,
  sub_category_name TEXT,
  form_code TEXT,
  form_name TEXT,
  route_code TEXT,
  route_name TEXT,
  type_code TEXT,
  type_name TEXT,
  atc_code TEXT,
  barcode TEXT,
  prescription_required BOOLEAN,
  purchase_price NUMERIC(14,2),
  selling_price NUMERIC(14,2),
  stock_min NUMERIC(14,3)
) ON COMMIT DROP;

WITH base_products AS (
  SELECT *
  FROM (VALUES
    ('ANT', 'Antalgiques', 'ANT-PAR', 'Douleur et fievre', 'Paracetamol', 'Paracetamol', '500 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'N02BE01', FALSE, 0.35, 0.60, 25),
    ('ANT', 'Antalgiques', 'ANT-IBU', 'Anti-inflammatoires', 'Ibuprofene', 'Ibuprofene', '400 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'M01AE01', FALSE, 0.55, 0.95, 20),
    ('ATB', 'Antibiotiques', 'ATB-PEN', 'Penicillines', 'Amoxicilline', 'Amoxicilline', '500 mg', 'GEL', 'Gelule', 'ORAL', 'Orale', 'MED', 'Medicament', 'J01CA04', TRUE, 1.10, 1.85, 18),
    ('ATB', 'Antibiotiques', 'ATB-PEN', 'Penicillines', 'Amoxicilline acide clavulanique', 'Amoxicilline + acide clavulanique', '625 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'J01CR02', TRUE, 2.40, 3.80, 15),
    ('ATB', 'Antibiotiques', 'ATB-AZI', 'Macrolides', 'Azithromycine', 'Azithromycine', '500 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'J01FA10', TRUE, 2.20, 3.60, 12),
    ('PAL', 'Antipaludiques', 'PAL-ALU', 'ACT', 'Coartem', 'Artemether + Lumefantrine', '20/120 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'P01BF01', TRUE, 1.60, 2.70, 20),
    ('PAL', 'Antipaludiques', 'PAL-ART', 'Artesunate', 'Artesunate injectable', 'Artesunate', '60 mg', 'INJ', 'Injectable', 'IV', 'Intraveineuse', 'MED', 'Medicament', 'P01BE03', TRUE, 3.10, 5.00, 10),
    ('VIT', 'Vitamines', 'VIT-C', 'Vitamines simples', 'Vitamine C', 'Acide ascorbique', '500 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'A11GA01', FALSE, 0.28, 0.50, 25),
    ('VIT', 'Vitamines', 'VIT-MUL', 'Multivitamines', 'Multivitamines', 'Complexe multivitamine', 'Adulte', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'A11AA03', FALSE, 0.75, 1.25, 18),
    ('SOL', 'Solutes', 'SOL-RL', 'Perfusion', 'Ringer Lactate', 'Ringer lactate', '500 ml', 'SOL', 'Solution', 'IV', 'Intraveineuse', 'MED', 'Medicament', 'B05BB01', FALSE, 1.05, 1.75, 15),
    ('SOL', 'Solutes', 'SOL-NS', 'Perfusion', 'Chlorure de sodium', 'NaCl', '0.9% 500 ml', 'SOL', 'Solution', 'IV', 'Intraveineuse', 'MED', 'Medicament', 'B05XA03', FALSE, 0.95, 1.60, 15),
    ('ANTISEP', 'Antiseptiques', 'ANTISEP-ALC', 'Desinfectants', 'Alcool 70', 'Ethanol', '70%', 'SOL', 'Solution', 'TOP', 'Cutanee', 'HYG', 'Hygiene et desinfection', 'D08AX08', FALSE, 1.20, 2.00, 12),
    ('ANTISEP', 'Antiseptiques', 'ANTISEP-PVI', 'Iodes', 'Povidone iodee', 'Povidone iodee', '10%', 'SOL', 'Solution', 'TOP', 'Cutanee', 'MED', 'Medicament', 'D08AG02', FALSE, 1.55, 2.60, 10),
    ('ORL', 'ORL', 'ORL-SER', 'Nez', 'Serum physiologique nasal', 'Chlorure de sodium', '0.9%', 'GTT', 'Gouttes', 'ENT', 'ORL', 'MED', 'Medicament', 'R01AX10', FALSE, 0.65, 1.10, 18),
    ('ORL', 'ORL', 'ORL-CET', 'Allergies', 'Cetirizine', 'Cetirizine', '10 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'R06AE07', FALSE, 0.42, 0.75, 20),
    ('GASTRO', 'Gastro', 'GAS-OMP', 'Antiulcereux', 'Omeprazole', 'Omeprazole', '20 mg', 'GEL', 'Gelule', 'ORAL', 'Orale', 'MED', 'Medicament', 'A02BC01', FALSE, 0.50, 0.90, 18),
    ('GASTRO', 'Gastro', 'GAS-SRO', 'Rehydratation', 'SRO', 'Sels de rehydratation orale', 'Sachet', 'PDR', 'Poudre', 'ORAL', 'Orale', 'MED', 'Medicament', 'A07CA', FALSE, 0.20, 0.40, 30),
    ('CARDIO', 'Cardio', 'CAR-AML', 'Antihypertenseurs', 'Amlodipine', 'Amlodipine', '5 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'C08CA01', TRUE, 0.45, 0.80, 16),
    ('DIAB', 'Diabete', 'DIA-MET', 'Antidiabetiques oraux', 'Metformine', 'Metformine', '500 mg', 'CP', 'Comprime', 'ORAL', 'Orale', 'MED', 'Medicament', 'A10BA02', TRUE, 0.38, 0.70, 18),
    ('CONSO', 'Consommables medicaux', 'CON-GNT', 'Protection', 'Gants medicaux', NULL, 'Taille M', 'DMD', 'Dispositif', 'EXT', 'Usage externe', 'CON', 'Consommable medical', NULL, FALSE, 2.50, 4.00, 10)
  ) AS b(category_code, category_name, sub_category_code, sub_category_name, commercial_name, dci, dosage, form_code, form_name, route_code, route_name, type_code, type_name, atc_code, prescription_required, purchase_price, selling_price, stock_min)
),
variants AS (
  SELECT *
  FROM (VALUES
    (1, 'Boite 10', 1.00, 1.00),
    (2, 'Boite 20', 1.85, 1.50),
    (3, 'Unite', 0.12, 4.00),
    (4, 'Pack clinique', 3.20, 0.70),
    (5, 'Format economique', 2.60, 0.90)
  ) AS v(variant_no, variant_label, price_factor, stock_factor)
),
numbered AS (
  SELECT
    row_number() OVER (ORDER BY b.category_code, b.sub_category_code, b.commercial_name, v.variant_no) AS rn,
    b.*,
    v.variant_label,
    v.price_factor,
    v.stock_factor
  FROM base_products b
  CROSS JOIN variants v
)
INSERT INTO demo_product_data
SELECT
  'PHD-' || lpad(rn::TEXT, 3, '0') AS article_code,
  commercial_name || ' - ' || variant_label AS commercial_name,
  dci,
  dosage,
  'PHD-' || category_code AS category_code,
  category_name AS category_name,
  'PHD-' || sub_category_code AS sub_category_code,
  sub_category_name,
  'PHD-' || form_code AS form_code,
  form_name AS form_name,
  'PHD-' || route_code AS route_code,
  route_name AS route_name,
  'PHD-' || type_code AS type_code,
  type_name AS type_name,
  atc_code,
  '620' || lpad((1000000000 + rn)::TEXT, 10, '0') AS barcode,
  prescription_required,
  round(purchase_price * price_factor, 2),
  round(selling_price * price_factor, 2),
  greatest(3, round(stock_min * stock_factor))::NUMERIC(14,3)
FROM numbered;

INSERT INTO tenants (
  tenant_code, tenant_name, tenant_type, legal_name, phone, email, address,
  country, city, subscription_status, is_active
)
VALUES (
  'PHARMACIE_DEMO',
  'Pharmacie Demo',
  'PHARMACY',
  'Pharmacie Demo Kinshasa SARL',
  '+243810000100',
  'contact@pharmacie-demo.local',
  'Avenue Colonel Mondjiba, Kinshasa',
  'RDC',
  'Kinshasa',
  'ACTIVE',
  TRUE
)
ON CONFLICT (tenant_code) DO UPDATE
SET tenant_name = EXCLUDED.tenant_name,
    tenant_type = EXCLUDED.tenant_type,
    legal_name = EXCLUDED.legal_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
    subscription_status = EXCLUDED.subscription_status,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO currencies(currency_code, currency_name, is_default)
VALUES
  ('USD', 'Dollar americain ($)', TRUE),
  ('CDF', 'Franc congolais (FC)', FALSE)
ON CONFLICT (currency_code) DO UPDATE
SET currency_name = EXCLUDED.currency_name,
    is_default = EXCLUDED.is_default;

INSERT INTO tenant_settings (
  tenant_id,
  setting_key,
  setting_value
)
SELECT
  t.tenant_id,
  'USD_CDF_RATE',
  '2800'
FROM tenants t
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (tenant_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO payment_methods(method_code, method_name, is_active)
VALUES ('CASH', 'Cash', TRUE)
ON CONFLICT (method_code) DO UPDATE
SET method_name = EXCLUDED.method_name,
    is_active = EXCLUDED.is_active;

INSERT INTO sites(tenant_id, site_code, site_name, site_type, address, phone, is_active)
SELECT tenant_id, 'PHD-KIN', 'PHARMACIE DEMO KINSHASA', 'PHARMACY',
       'Avenue Colonel Mondjiba, Kinshasa', '+243810000101', TRUE
FROM tenants
WHERE tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (site_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    site_name = EXCLUDED.site_name,
    site_type = EXCLUDED.site_type,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    is_active = EXCLUDED.is_active;

INSERT INTO roles(tenant_id, role_name, description, is_active)
SELECT t.tenant_id, 'ADMIN', 'Administrateur systeme', TRUE
FROM tenants t
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (tenant_id, role_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
VALUES
  ('settings.exchange_rate.read', 'Consulter taux de change', 'Settings', 'Voir le taux USD/CDF du tenant', TRUE),
  ('settings.exchange_rate.update', 'Modifier taux de change', 'Settings', 'Modifier le taux USD/CDF du tenant', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = EXCLUDED.is_system_permission;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
CROSS JOIN permissions p
WHERE t.tenant_code = 'PHARMACIE_DEMO'
  AND r.role_name = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO users(
  tenant_id, site_id, role_id, full_name, username, email, phone, password_hash, is_active
)
SELECT
  t.tenant_id,
  s.site_id,
  r.role_id,
  'Admin Pharmacie Demo',
  'admin.pharmacie.demo',
  'admin@pharmacie-demo.local',
  '+243810000102',
  '$2a$10$jLWOKu8vOzTT4wdtbCuMc.Bd1bx1KLzC.6yndJEcoDjzu9NU.xkCW',
  TRUE
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'PHD-KIN'
JOIN roles r ON r.tenant_id = t.tenant_id AND r.role_name = 'ADMIN'
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (username) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    site_id = EXCLUDED.site_id,
    role_id = EXCLUDED.role_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active;

-- Rebuild transactional demo data for this tenant only.
DELETE FROM journal_entry_lines jel
USING journal_entries je, tenants t
WHERE jel.entry_id = je.entry_id
  AND je.tenant_id = t.tenant_id
  AND t.tenant_code = 'PHARMACIE_DEMO';

DELETE FROM journal_entries je
USING tenants t
WHERE je.tenant_id = t.tenant_id
  AND t.tenant_code = 'PHARMACIE_DEMO';

DELETE FROM cash_movements cm
USING cash_sessions cs, tenants t
WHERE cm.cash_session_id = cs.cash_session_id
  AND cs.tenant_id = t.tenant_id
  AND t.tenant_code = 'PHARMACIE_DEMO';

DELETE FROM receivable_payments rp
USING accounts_receivable ar, tenants t
WHERE rp.receivable_id = ar.receivable_id
  AND ar.tenant_id = t.tenant_id
  AND t.tenant_code = 'PHARMACIE_DEMO';

DELETE FROM accounts_receivable ar USING tenants t WHERE ar.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM payments p USING tenants t WHERE p.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM sale_items si USING tenants t WHERE si.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM sales s USING tenants t WHERE s.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM inventory_items ii USING tenants t WHERE ii.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM inventory_sessions inv USING tenants t WHERE inv.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM stock_movements sm USING tenants t WHERE sm.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM stocks st USING tenants t WHERE st.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM lots l USING tenants t WHERE l.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM purchase_items pi USING tenants t WHERE pi.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM purchases p USING tenants t WHERE p.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';
DELETE FROM cash_sessions cs USING tenants t WHERE cs.tenant_id = t.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO';

INSERT INTO product_types(tenant_id, type_code, type_name)
SELECT DISTINCT t.tenant_id, d.type_code, d.type_name
FROM tenants t
CROSS JOIN demo_product_data d
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (type_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    type_name = EXCLUDED.type_name;

INSERT INTO categories(tenant_id, category_code, category_name, description, is_active)
SELECT DISTINCT t.tenant_id, d.category_code, d.category_name, 'Categorie demo pharmacie', TRUE
FROM tenants t
CROSS JOIN demo_product_data d
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (category_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    category_name = EXCLUDED.category_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO sub_categories(tenant_id, category_id, sub_category_code, sub_category_name, description, is_active)
SELECT t.tenant_id, c.category_id, min(d.sub_category_code), d.sub_category_name, 'Sous-categorie demo pharmacie', TRUE
FROM tenants t
JOIN demo_product_data d ON TRUE
JOIN categories c ON c.category_code = d.category_code
WHERE t.tenant_code = 'PHARMACIE_DEMO'
GROUP BY t.tenant_id, c.category_id, d.sub_category_name
ON CONFLICT (category_id, sub_category_name) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    sub_category_code = EXCLUDED.sub_category_code,
    sub_category_name = EXCLUDED.sub_category_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO galenic_forms(tenant_id, form_code, form_name)
SELECT DISTINCT t.tenant_id, d.form_code, d.form_name
FROM tenants t
CROSS JOIN demo_product_data d
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (form_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    form_name = EXCLUDED.form_name;

INSERT INTO administration_routes(tenant_id, route_code, route_name)
SELECT DISTINCT t.tenant_id, d.route_code, d.route_name
FROM tenants t
CROSS JOIN demo_product_data d
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (route_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    route_name = EXCLUDED.route_name;

INSERT INTO articles(
  tenant_id, article_code, commercial_name, dci, category_id, sub_category_id,
  form_id, route_id, product_type_id, dosage, packaging, atc_code,
  barcode, prescription_required, default_stock_min, default_stock_max, is_active, updated_at
)
SELECT
  t.tenant_id,
  d.article_code,
  d.commercial_name,
  d.dci,
  c.category_id,
  sc.sub_category_id,
  gf.form_id,
  ar.route_id,
  pt.product_type_id,
  d.dosage,
  split_part(d.commercial_name, ' - ', 2),
  d.atc_code,
  d.barcode,
  d.prescription_required,
  d.stock_min,
  d.stock_min * 10,
  TRUE,
  CURRENT_TIMESTAMP
FROM tenants t
JOIN demo_product_data d ON TRUE
JOIN categories c ON c.category_code = d.category_code
JOIN sub_categories sc ON sc.category_id = c.category_id AND sc.sub_category_name = d.sub_category_name
JOIN galenic_forms gf ON gf.form_code = d.form_code
JOIN administration_routes ar ON ar.route_code = d.route_code
JOIN product_types pt ON pt.type_code = d.type_code
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (article_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    commercial_name = EXCLUDED.commercial_name,
    dci = EXCLUDED.dci,
    category_id = EXCLUDED.category_id,
    sub_category_id = EXCLUDED.sub_category_id,
    form_id = EXCLUDED.form_id,
    route_id = EXCLUDED.route_id,
    product_type_id = EXCLUDED.product_type_id,
    dosage = EXCLUDED.dosage,
    packaging = EXCLUDED.packaging,
    atc_code = EXCLUDED.atc_code,
    barcode = EXCLUDED.barcode,
    prescription_required = EXCLUDED.prescription_required,
    default_stock_min = EXCLUDED.default_stock_min,
    default_stock_max = EXCLUDED.default_stock_max,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO suppliers(tenant_id, supplier_code, supplier_name, phone, email, address, is_active)
SELECT t.tenant_id, data.code, data.name, data.phone, data.email, data.address, TRUE
FROM tenants t
CROSS JOIN (VALUES
  ('PHD-FRN-001','Medipharm RDC','+243810001001','contact@medipharm-rdc.local','Kinshasa Gombe'),
  ('PHD-FRN-002','Congo Pharma Distribution','+243810001002','vente@congopharma.local','Limete Industriel'),
  ('PHD-FRN-003','AfriMedic Supply','+243810001003','orders@afrimedicsupply.local','Kinshasa Matete'),
  ('PHD-FRN-004','Sante Express Grossiste','+243810001004','admin@santeexpress.local','Kinshasa Kintambo'),
  ('PHD-FRN-005','BioCare Medical','+243810001005','info@biocaremedical.local','Lubumbashi'),
  ('PHD-FRN-006','PharmaPlus Central','+243810001006','sales@pharmaplus.local','Kinshasa Lingwala'),
  ('PHD-FRN-007','SotraMed','+243810001007','contact@sotramed.local','Matadi'),
  ('PHD-FRN-008','Clinique Supply RDC','+243810001008','commande@cliniquesupply.local','Kinshasa Ngaliema'),
  ('PHD-FRN-009','Delta Sante Import','+243810001009','import@deltasante.local','Kinshasa Barumbu'),
  ('PHD-FRN-010','Medicalis Afrique','+243810001010','desk@medicalis.local','Kinshasa Gombe')
) AS data(code, name, phone, email, address)
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (supplier_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    supplier_name = EXCLUDED.supplier_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    is_active = TRUE;

INSERT INTO customers(tenant_id, customer_code, customer_name, customer_type, phone, email, address, credit_allowed, credit_limit, is_active)
SELECT t.tenant_id, 'PHD-CLI-' || lpad(gs::TEXT, 3, '0'),
       data.customer_name,
       CASE WHEN gs <= 10 THEN 'INSURANCE_MEMBER' ELSE 'INDIVIDUAL' END,
       '+24382000' || lpad(gs::TEXT, 4, '0'),
       lower(replace(data.customer_name, ' ', '.')) || '@demo.local',
       'Kinshasa',
       gs <= 10,
       CASE WHEN gs <= 10 THEN 500 ELSE 0 END,
       TRUE
FROM tenants t
JOIN generate_series(1,20) gs ON TRUE
JOIN (VALUES
  (1,'Aline Mbala'),(2,'Patrick Ilunga'),(3,'Merveille Kanku'),(4,'Jean Mukendi'),(5,'Chantal Luyindula'),
  (6,'Grace Tshibanda'),(7,'Cedric Mbuyi'),(8,'Nadine Kabasele'),(9,'Serge Matondo'),(10,'Clarisse Nsimba'),
  (11,'Joseph Kabongo'),(12,'Sarah Beya'),(13,'Herve Mpoyi'),(14,'Carine Kayembe'),(15,'Emmanuel Kalala'),
  (16,'Diane Lukusa'),(17,'Michel Kazadi'),(18,'Prisca Mwamba'),(19,'Eric Mavungu'),(20,'Linda Kasongo')
) AS data(no, customer_name) ON data.no = gs
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (customer_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    customer_name = EXCLUDED.customer_name,
    customer_type = EXCLUDED.customer_type,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    credit_allowed = EXCLUDED.credit_allowed,
    credit_limit = EXCLUDED.credit_limit,
    is_active = TRUE;

INSERT INTO organizations(tenant_id, organization_code, organization_name, organization_type, phone, email, address, credit_allowed, credit_limit, payment_terms_days, is_active)
SELECT t.tenant_id, data.code, data.name, 'INSURANCE', data.phone, data.email, 'Kinshasa', TRUE, data.limit_amount, 30, TRUE
FROM tenants t
CROSS JOIN (VALUES
  ('PHD-ORG-SPA','SantePlus Assurance','+243830000001','claims@santeplus.local', 5000::NUMERIC),
  ('PHD-ORG-MUT','Mutualis Sante','+243830000002','claims@mutualis.local', 3500::NUMERIC)
) AS data(code, name, phone, email, limit_amount)
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (organization_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    organization_name = EXCLUDED.organization_name,
    organization_type = EXCLUDED.organization_type,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    credit_allowed = TRUE,
    credit_limit = EXCLUDED.credit_limit,
    payment_terms_days = 30,
    is_active = TRUE;

INSERT INTO insurance_plans(tenant_id, organization_id, plan_code, plan_name, coverage_percent, patient_copay_percent, monthly_limit, annual_limit, requires_authorization, is_active)
SELECT t.tenant_id, o.organization_id, data.plan_code, data.plan_name, data.coverage, 100 - data.coverage, 800, 8000, FALSE, TRUE
FROM tenants t
JOIN organizations o ON o.tenant_id = t.tenant_id
JOIN (VALUES
  ('PHD-ORG-SPA','SPA-80','SantePlus 80 pourcent',80::NUMERIC),
  ('PHD-ORG-MUT','MUT-70','Mutualis 70 pourcent',70::NUMERIC)
) AS data(org_code, plan_code, plan_name, coverage) ON data.org_code = o.organization_code
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (organization_id, plan_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    plan_name = EXCLUDED.plan_name,
    coverage_percent = EXCLUDED.coverage_percent,
    patient_copay_percent = EXCLUDED.patient_copay_percent,
    monthly_limit = EXCLUDED.monthly_limit,
    annual_limit = EXCLUDED.annual_limit,
    requires_authorization = FALSE,
    is_active = TRUE;

INSERT INTO customer_memberships(tenant_id, customer_id, organization_id, plan_id, member_number, relationship_type, valid_from, valid_to, is_active)
SELECT
  t.tenant_id,
  c.customer_id,
  o.organization_id,
  ip.plan_id,
  'PHD-MEM-' || lpad(gs::TEXT, 3, '0'),
  'MAIN',
  CURRENT_DATE - INTERVAL '180 days',
  CURRENT_DATE + INTERVAL '365 days',
  TRUE
FROM tenants t
JOIN generate_series(1,10) gs ON TRUE
JOIN customers c ON c.tenant_id = t.tenant_id AND c.customer_code = 'PHD-CLI-' || lpad(gs::TEXT, 3, '0')
JOIN organizations o ON o.tenant_id = t.tenant_id AND o.organization_code = CASE WHEN gs % 2 = 0 THEN 'PHD-ORG-MUT' ELSE 'PHD-ORG-SPA' END
JOIN insurance_plans ip ON ip.organization_id = o.organization_id
WHERE t.tenant_code = 'PHARMACIE_DEMO'
  AND ((gs % 2 = 0 AND ip.plan_code = 'MUT-70') OR (gs % 2 = 1 AND ip.plan_code = 'SPA-80'))
ON CONFLICT (customer_id, organization_id, member_number) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    plan_id = EXCLUDED.plan_id,
    relationship_type = EXCLUDED.relationship_type,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    is_active = TRUE;

INSERT INTO cash_registers(tenant_id, site_id, register_code, register_name, currency_id, is_active)
SELECT t.tenant_id, s.site_id, 'PHD-MAIN', 'Caisse principale Pharmacie Demo', c.currency_id, TRUE
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'PHD-KIN'
JOIN currencies c ON c.currency_code = 'USD'
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (tenant_id, site_id, register_code) DO UPDATE
SET register_name = EXCLUDED.register_name,
    currency_id = EXCLUDED.currency_id,
    is_active = TRUE;

INSERT INTO chart_of_accounts(tenant_id, account_code, account_name, account_type, is_active)
SELECT t.tenant_id, data.code, data.name, data.type, TRUE
FROM tenants t
CROSS JOIN (VALUES
  ('37','Stock marchandises pharmaceutiques','ASSET'),
  ('41','Clients / Creances','ASSET'),
  ('52','Banque','ASSET'),
  ('57','Caisse','ASSET'),
  ('60','Achats marchandises','EXPENSE'),
  ('70','Ventes marchandises','REVENUE'),
  ('709','Remises accordees','EXPENSE')
) AS data(code, name, type)
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (tenant_id, account_code) DO UPDATE
SET account_name = EXCLUDED.account_name,
    account_type = EXCLUDED.account_type,
    is_active = TRUE;

INSERT INTO accounting_journals(tenant_id, journal_code, journal_name, journal_type, is_active)
SELECT t.tenant_id, data.code, data.name, data.type, TRUE
FROM tenants t
CROSS JOIN (VALUES
  ('VEN','Journal des ventes','SALES'),
  ('CAI','Journal de caisse','CASH'),
  ('OD','Operations diverses','GENERAL')
) AS data(code, name, type)
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (tenant_id, journal_code) DO UPDATE
SET journal_name = EXCLUDED.journal_name,
    journal_type = EXCLUDED.journal_type,
    is_active = TRUE;

INSERT INTO purchases(tenant_id, purchase_number, purchase_date, supplier_id, site_id, currency_id, total_amount, status, created_by, validated_at)
SELECT
  t.tenant_id,
  'PHD-ACH-' || lpad(gs::TEXT, 3, '0'),
  CURRENT_DATE - ((45 - gs * 3)::TEXT || ' days')::INTERVAL,
  sp.supplier_id,
  s.site_id,
  cur.currency_id,
  0,
  'VALIDATED',
  u.user_id,
  CURRENT_TIMESTAMP - ((45 - gs * 3)::TEXT || ' days')::INTERVAL
FROM tenants t
JOIN generate_series(1,10) gs ON TRUE
JOIN suppliers sp ON sp.tenant_id = t.tenant_id AND sp.supplier_code = 'PHD-FRN-' || lpad(gs::TEXT, 3, '0')
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'PHD-KIN'
JOIN currencies cur ON cur.currency_code = 'USD'
JOIN users u ON u.tenant_id = t.tenant_id AND u.username = 'admin.pharmacie.demo'
WHERE t.tenant_code = 'PHARMACIE_DEMO';

WITH numbered_articles AS (
  SELECT
    a.article_id,
    a.article_code,
    d.purchase_price,
    d.selling_price,
    d.stock_min,
    row_number() OVER (ORDER BY a.article_code) AS rn
  FROM articles a
  JOIN tenants t ON t.tenant_id = a.tenant_id
  JOIN demo_product_data d ON d.article_code = a.article_code
  WHERE t.tenant_code = 'PHARMACIE_DEMO'
)
INSERT INTO purchase_items(tenant_id, purchase_id, article_id, lot_number, expiry_date, quantity, purchase_unit_price, selling_unit_price, line_total)
SELECT
  t.tenant_id,
  p.purchase_id,
  na.article_id,
  'LOT-' || na.article_code,
  CURRENT_DATE + (
    CASE
      WHEN na.rn <= 8 THEN (18 + na.rn)
      WHEN na.rn <= 22 THEN (55 + na.rn)
      ELSE (180 + (na.rn % 240))
    END::TEXT || ' days'
  )::INTERVAL,
  CASE WHEN na.rn % 17 = 0 THEN greatest(2, na.stock_min - 1) ELSE 35 + (na.rn % 55) END,
  na.purchase_price,
  na.selling_price,
  (CASE WHEN na.rn % 17 = 0 THEN greatest(2, na.stock_min - 1) ELSE 35 + (na.rn % 55) END) * na.purchase_price
FROM numbered_articles na
JOIN tenants t ON t.tenant_code = 'PHARMACIE_DEMO'
JOIN purchases p ON p.tenant_id = t.tenant_id AND p.purchase_number = 'PHD-ACH-' || lpad((((na.rn - 1) / 10) + 1)::TEXT, 3, '0');

UPDATE purchases p
SET total_amount = totals.total_amount
FROM (
  SELECT purchase_id, sum(line_total) AS total_amount
  FROM purchase_items
  WHERE tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
  GROUP BY purchase_id
) totals
WHERE totals.purchase_id = p.purchase_id;

INSERT INTO lots(tenant_id, article_id, supplier_id, lot_number, manufacture_date, expiry_date, purchase_price, selling_price, currency_id, is_blocked)
SELECT pi.tenant_id, pi.article_id, p.supplier_id, pi.lot_number,
       pi.expiry_date - INTERVAL '365 days', pi.expiry_date,
       pi.purchase_unit_price, pi.selling_unit_price, p.currency_id, FALSE
FROM purchase_items pi
JOIN purchases p ON p.purchase_id = pi.purchase_id
WHERE pi.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
ON CONFLICT (article_id, lot_number) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    supplier_id = EXCLUDED.supplier_id,
    manufacture_date = EXCLUDED.manufacture_date,
    expiry_date = EXCLUDED.expiry_date,
    purchase_price = EXCLUDED.purchase_price,
    selling_price = EXCLUDED.selling_price,
    currency_id = EXCLUDED.currency_id,
    is_blocked = FALSE,
    block_reason = NULL;

INSERT INTO stocks(tenant_id, site_id, lot_id, quantity_available, quantity_reserved, stock_min, stock_max, updated_at)
SELECT pi.tenant_id, p.site_id, l.lot_id, pi.quantity, 0, a.default_stock_min, a.default_stock_max, CURRENT_TIMESTAMP
FROM purchase_items pi
JOIN purchases p ON p.purchase_id = pi.purchase_id
JOIN lots l ON l.article_id = pi.article_id AND l.lot_number = pi.lot_number
JOIN articles a ON a.article_id = pi.article_id
WHERE pi.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
ON CONFLICT (site_id, lot_id) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    quantity_available = EXCLUDED.quantity_available,
    quantity_reserved = 0,
    stock_min = EXCLUDED.stock_min,
    stock_max = EXCLUDED.stock_max,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO stock_movements(tenant_id, movement_date, site_id, article_id, lot_id, movement_type, quantity, reference_type, reference_id, notes, user_id)
SELECT pi.tenant_id, p.validated_at, p.site_id, pi.article_id, l.lot_id, 'PURCHASE_IN', pi.quantity, 'PURCHASE', p.purchase_id,
       'Stock initial demo', p.created_by
FROM purchase_items pi
JOIN purchases p ON p.purchase_id = pi.purchase_id
JOIN lots l ON l.article_id = pi.article_id AND l.lot_number = pi.lot_number
WHERE pi.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO');

INSERT INTO cash_sessions(tenant_id, site_id, user_id, cash_register_id, opened_at, closed_at, opening_balance, closing_balance, expected_closing_balance, difference_amount, status, validated_by, validated_at, notes)
SELECT t.tenant_id, s.site_id, u.user_id, cr.cash_register_id,
       CURRENT_DATE - INTERVAL '30 days',
       CURRENT_TIMESTAMP,
       100,
       100,
       100,
       0,
       'CLOSED',
       u.user_id,
       CURRENT_TIMESTAMP,
       'Session demo consolidee'
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'PHD-KIN'
JOIN users u ON u.tenant_id = t.tenant_id AND u.username = 'admin.pharmacie.demo'
JOIN cash_registers cr ON cr.tenant_id = t.tenant_id AND cr.site_id = s.site_id AND cr.register_code = 'PHD-MAIN'
WHERE t.tenant_code = 'PHARMACIE_DEMO';

WITH stock_pick AS (
  SELECT st.stock_id, st.tenant_id, st.site_id, l.lot_id, l.article_id, l.selling_price,
         row_number() OVER (ORDER BY a.article_code) AS rn
  FROM stocks st
  JOIN lots l ON l.lot_id = st.lot_id
  JOIN articles a ON a.article_id = l.article_id
  JOIN tenants t ON t.tenant_id = st.tenant_id
  WHERE t.tenant_code = 'PHARMACIE_DEMO'
),
sale_seed AS (
  SELECT gs,
         CASE WHEN gs <= 4 THEN CURRENT_TIMESTAMP - (gs::TEXT || ' hours')::INTERVAL
              ELSE CURRENT_TIMESTAMP - ((gs % 30)::TEXT || ' days')::INTERVAL
          END AS sale_date,
         CASE WHEN gs % 4 = 0 THEN 'INSURANCE' ELSE 'CASH' END AS sale_type,
         1 + (gs % 3) AS quantity,
         1 + ((gs * 7) % 100) AS stock_rn
  FROM generate_series(1,60) gs
)
INSERT INTO sales(tenant_id, sale_number, sale_date, customer_id, organization_id, membership_id, site_id, currency_id, subtotal, discount_amount, insurance_covered_amount, customer_payable_amount, credit_amount, total_amount, sale_type, status, created_by, validated_at)
SELECT
  t.tenant_id,
  'PHD-VEN-' || lpad(ss.gs::TEXT, 4, '0'),
  ss.sale_date,
  c.customer_id,
  CASE WHEN ss.sale_type = 'INSURANCE' THEN o.organization_id ELSE NULL END,
  CASE WHEN ss.sale_type = 'INSURANCE' THEN m.membership_id ELSE NULL END,
  sp.site_id,
  cur.currency_id,
  round(sp.selling_price * ss.quantity, 2),
  0,
  CASE WHEN ss.sale_type = 'INSURANCE' THEN round(sp.selling_price * ss.quantity * (ip.coverage_percent / 100), 2) ELSE 0 END,
  CASE WHEN ss.sale_type = 'INSURANCE' THEN round(sp.selling_price * ss.quantity * (1 - ip.coverage_percent / 100), 2) ELSE round(sp.selling_price * ss.quantity, 2) END,
  CASE WHEN ss.sale_type = 'INSURANCE' THEN round(sp.selling_price * ss.quantity * (ip.coverage_percent / 100), 2) ELSE 0 END,
  round(sp.selling_price * ss.quantity, 2),
  ss.sale_type,
  'VALIDATED',
  u.user_id,
  ss.sale_date
FROM sale_seed ss
JOIN tenants t ON t.tenant_code = 'PHARMACIE_DEMO'
JOIN stock_pick sp ON sp.rn = ss.stock_rn
JOIN currencies cur ON cur.currency_code = 'USD'
JOIN users u ON u.tenant_id = t.tenant_id AND u.username = 'admin.pharmacie.demo'
JOIN customers c ON c.tenant_id = t.tenant_id
  AND c.customer_code = 'PHD-CLI-' || lpad((
    CASE
      WHEN ss.sale_type = 'INSURANCE' THEN ((ss.gs - 1) % 10 + 1)
      ELSE ((ss.gs - 1) % 20 + 1)
    END
  )::TEXT, 3, '0')
LEFT JOIN customer_memberships m ON m.customer_id = c.customer_id AND m.is_active = TRUE
LEFT JOIN organizations o ON o.organization_id = m.organization_id
LEFT JOIN insurance_plans ip ON ip.plan_id = m.plan_id;

INSERT INTO sale_items(tenant_id, sale_id, article_id, lot_id, quantity, unit_price, discount_amount, coverage_percent, covered_amount, patient_amount, line_total)
SELECT
  s.tenant_id,
  s.sale_id,
  l.article_id,
  l.lot_id,
  1 + ((right(s.sale_number, 2)::INT) % 3),
  l.selling_price,
  0,
  CASE WHEN s.sale_type = 'INSURANCE' AND s.total_amount > 0 THEN round((s.insurance_covered_amount / s.total_amount) * 100, 2) ELSE 0 END,
  s.insurance_covered_amount,
  s.customer_payable_amount,
  s.total_amount
FROM sales s
JOIN tenants t ON t.tenant_id = s.tenant_id AND t.tenant_code = 'PHARMACIE_DEMO'
JOIN stocks st ON st.tenant_id = s.tenant_id
JOIN lots l ON l.lot_id = st.lot_id
JOIN articles a ON a.article_id = l.article_id
WHERE a.article_code = 'PHD-' || lpad((1 + ((right(s.sale_number, 4)::INT * 7) % 100))::TEXT, 3, '0');

UPDATE stocks st
SET quantity_available = greatest(0, st.quantity_available - totals.quantity),
    updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT tenant_id, lot_id, sum(quantity) AS quantity
  FROM sale_items
  WHERE tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
  GROUP BY tenant_id, lot_id
) totals
WHERE totals.lot_id = st.lot_id
  AND totals.tenant_id = st.tenant_id;

INSERT INTO stock_movements(tenant_id, movement_date, site_id, article_id, lot_id, movement_type, quantity, reference_type, reference_id, notes, user_id)
SELECT s.tenant_id, s.sale_date, s.site_id, si.article_id, si.lot_id, 'SALE_OUT', si.quantity, 'SALE', s.sale_id,
       'Sortie vente demo', s.created_by
FROM sale_items si
JOIN sales s ON s.sale_id = si.sale_id;

INSERT INTO payments(tenant_id, sale_id, payment_date, payment_method_id, currency_id, amount, reference_payment, received_by)
SELECT s.tenant_id, s.sale_id, s.sale_date, pm.payment_method_id, s.currency_id, s.customer_payable_amount,
       'PAY-' || s.sale_number, s.created_by
FROM sales s
JOIN payment_methods pm ON pm.method_code = 'CASH'
WHERE s.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
  AND s.customer_payable_amount > 0;

INSERT INTO accounts_receivable(tenant_id, sale_id, customer_id, organization_id, currency_id, receivable_type, invoice_number, issue_date, due_date, amount_due, amount_paid, balance, status, notes, created_by)
SELECT s.tenant_id, s.sale_id, s.customer_id, s.organization_id, s.currency_id, 'INSURANCE_CLAIM',
       'PHD-REC-' || right(s.sale_number, 4),
       date(s.sale_date),
       date(s.sale_date) + INTERVAL '30 days',
       s.insurance_covered_amount,
       CASE WHEN right(s.sale_number, 2)::INT % 3 = 0 THEN s.insurance_covered_amount
            WHEN right(s.sale_number, 2)::INT % 3 = 1 THEN round(s.insurance_covered_amount * 0.5, 2)
            ELSE 0 END,
       CASE WHEN right(s.sale_number, 2)::INT % 3 = 0 THEN 0
            WHEN right(s.sale_number, 2)::INT % 3 = 1 THEN s.insurance_covered_amount - round(s.insurance_covered_amount * 0.5, 2)
            ELSE s.insurance_covered_amount END,
       CASE WHEN right(s.sale_number, 2)::INT % 3 = 0 THEN 'PAID'
            WHEN right(s.sale_number, 2)::INT % 3 = 1 THEN 'PARTIALLY_PAID'
            ELSE 'OPEN' END,
       'Creance assurance demo',
       s.created_by
FROM sales s
WHERE s.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
  AND s.sale_type = 'INSURANCE'
  AND s.insurance_covered_amount > 0;

INSERT INTO receivable_payments(tenant_id, receivable_id, payment_date, payment_method_id, currency_id, amount, reference_payment, received_by, notes)
SELECT ar.tenant_id, ar.receivable_id, CURRENT_TIMESTAMP - INTERVAL '2 days', pm.payment_method_id, ar.currency_id, ar.amount_paid,
       'RP-' || ar.invoice_number, ar.created_by, 'Paiement assurance demo'
FROM accounts_receivable ar
JOIN payment_methods pm ON pm.method_code = 'CASH'
WHERE ar.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
  AND ar.amount_paid > 0;

INSERT INTO cash_movements(tenant_id, cash_session_id, movement_date, movement_type, amount, currency_id, reference_type, reference_id, description, created_by)
SELECT p.tenant_id, cs.cash_session_id, p.payment_date, 'SALE_PAYMENT', p.amount, p.currency_id, 'SALE', p.sale_id,
       'Encaissement vente demo', p.received_by
FROM payments p
JOIN cash_sessions cs ON cs.tenant_id = p.tenant_id
WHERE p.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO');

INSERT INTO cash_movements(tenant_id, cash_session_id, movement_date, movement_type, amount, currency_id, reference_type, reference_id, description, created_by)
SELECT rp.tenant_id, cs.cash_session_id, rp.payment_date, 'RECEIVABLE_PAYMENT', rp.amount, rp.currency_id, 'RECEIVABLE', rp.receivable_id,
       'Paiement creance assurance demo', rp.received_by
FROM receivable_payments rp
JOIN cash_sessions cs ON cs.tenant_id = rp.tenant_id
WHERE rp.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO');

INSERT INTO cash_movements(tenant_id, cash_session_id, movement_date, movement_type, amount, currency_id, reference_type, reference_id, description, created_by)
SELECT t.tenant_id, cs.cash_session_id, CURRENT_TIMESTAMP - INTERVAL '1 day', 'EXPENSE', 22.50, cur.currency_id, 'CASH_EXPENSE', cs.cash_session_id,
       'Petite depense exploitation demo', u.user_id
FROM tenants t
JOIN cash_sessions cs ON cs.tenant_id = t.tenant_id
JOIN currencies cur ON cur.currency_code = 'USD'
JOIN users u ON u.tenant_id = t.tenant_id AND u.username = 'admin.pharmacie.demo'
WHERE t.tenant_code = 'PHARMACIE_DEMO';

UPDATE cash_sessions cs
SET expected_closing_balance = cs.opening_balance + totals.cash_in - totals.cash_out,
    closing_balance = cs.opening_balance + totals.cash_in - totals.cash_out,
    difference_amount = 0
FROM (
  SELECT cash_session_id,
         sum(CASE WHEN movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT') THEN amount ELSE 0 END) AS cash_in,
         sum(CASE WHEN movement_type IN ('EXPENSE','CASH_OUT','BANK_DEPOSIT') THEN amount ELSE 0 END) AS cash_out
  FROM cash_movements
  GROUP BY cash_session_id
) totals
WHERE totals.cash_session_id = cs.cash_session_id
  AND cs.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO');

WITH inv_base AS (
  SELECT st.stock_id, st.tenant_id, st.site_id, l.lot_id, l.article_id, st.quantity_available,
         row_number() OVER (ORDER BY a.article_code) AS rn
  FROM stocks st
  JOIN lots l ON l.lot_id = st.lot_id
  JOIN articles a ON a.article_id = l.article_id
  JOIN tenants t ON t.tenant_id = st.tenant_id
  WHERE t.tenant_code = 'PHARMACIE_DEMO'
)
INSERT INTO inventory_sessions(tenant_id, site_id, inventory_number, inventory_type, inventory_date, status, notes, created_by, validated_by, validated_at)
SELECT t.tenant_id, s.site_id, data.number, 'PARTIAL', CURRENT_DATE - data.days_ago, 'VALIDATED', data.notes, u.user_id, u.user_id, CURRENT_TIMESTAMP - (data.days_ago::TEXT || ' days')::INTERVAL
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'PHD-KIN'
JOIN users u ON u.tenant_id = t.tenant_id AND u.username = 'admin.pharmacie.demo'
CROSS JOIN (VALUES
  ('PHD-INV-LOSS', 8, 'Inventaire demo avec perte'),
  ('PHD-INV-GAIN', 4, 'Inventaire demo avec gain')
) AS data(number, days_ago, notes)
WHERE t.tenant_code = 'PHARMACIE_DEMO';

WITH chosen AS (
  SELECT st.stock_id, st.tenant_id, st.site_id, l.lot_id, l.article_id, st.quantity_available,
         row_number() OVER (ORDER BY a.article_code) AS rn
  FROM stocks st
  JOIN lots l ON l.lot_id = st.lot_id
  JOIN articles a ON a.article_id = l.article_id
  JOIN tenants t ON t.tenant_id = st.tenant_id
  WHERE t.tenant_code = 'PHARMACIE_DEMO'
),
lines AS (
  SELECT inv.inventory_id, ch.*, -2::NUMERIC AS diff
  FROM inventory_sessions inv
  JOIN chosen ch ON ch.rn = 5
  WHERE inv.inventory_number = 'PHD-INV-LOSS'
  UNION ALL
  SELECT inv.inventory_id, ch.*, 3::NUMERIC AS diff
  FROM inventory_sessions inv
  JOIN chosen ch ON ch.rn = 6
  WHERE inv.inventory_number = 'PHD-INV-GAIN'
)
INSERT INTO inventory_items(tenant_id, inventory_id, article_id, lot_id, system_quantity, counted_quantity, difference_quantity, reason, counted_by, counted_at)
SELECT l.tenant_id, l.inventory_id, l.article_id, l.lot_id, l.quantity_available, greatest(0, l.quantity_available + l.diff), l.diff,
       CASE WHEN l.diff < 0 THEN 'Perte physique demo' ELSE 'Gain physique demo' END,
       u.user_id, CURRENT_TIMESTAMP
FROM lines l
JOIN users u ON u.tenant_id = l.tenant_id AND u.username = 'admin.pharmacie.demo';

UPDATE stocks st
SET quantity_available = greatest(0, st.quantity_available + ii.difference_quantity),
    updated_at = CURRENT_TIMESTAMP
FROM inventory_items ii
WHERE ii.lot_id = st.lot_id
  AND ii.tenant_id = st.tenant_id
  AND ii.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO');

INSERT INTO stock_movements(tenant_id, movement_date, site_id, article_id, lot_id, movement_type, quantity, reference_type, reference_id, notes, user_id)
SELECT inv.tenant_id, inv.validated_at, inv.site_id, ii.article_id, ii.lot_id,
       CASE WHEN ii.difference_quantity > 0 THEN 'INVENTORY_GAIN' ELSE 'INVENTORY_LOSS' END,
       abs(ii.difference_quantity), 'INVENTORY', inv.inventory_id, inv.notes, inv.validated_by
FROM inventory_items ii
JOIN inventory_sessions inv ON inv.inventory_id = ii.inventory_id
WHERE ii.difference_quantity <> 0
  AND inv.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO');

INSERT INTO audit_logs(tenant_id, action_date, user_id, table_name, record_id, action_type, new_value, ip_address)
SELECT t.tenant_id, CURRENT_TIMESTAMP, u.user_id, data.table_name, data.record_id, 'VALIDATE', data.payload::JSONB, '127.0.0.1'
FROM tenants t
JOIN users u ON u.tenant_id = t.tenant_id AND u.username = 'admin.pharmacie.demo'
JOIN (
  SELECT tenant_id, 'purchases' AS table_name, purchase_id AS record_id, '{"seed":"demo","type":"purchase"}' AS payload FROM purchases
  UNION ALL
  SELECT tenant_id, 'sales', sale_id, '{"seed":"demo","type":"sale"}' FROM sales
  UNION ALL
  SELECT tenant_id, 'inventory_sessions', inventory_id, '{"seed":"demo","type":"inventory"}' FROM inventory_sessions
) data ON data.tenant_id = t.tenant_id
WHERE t.tenant_code = 'PHARMACIE_DEMO';

-- Ecritures comptables minimales et equilibrees.
INSERT INTO journal_entries(tenant_id, journal_id, entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit, status, created_by, posted_by, posted_at)
SELECT
  s.tenant_id,
  j.journal_id,
  'PHD-JE-SALE-' || right(s.sale_number, 4),
  date(s.sale_date),
  'SALE',
  s.sale_id,
  'Vente demo ' || s.sale_number,
  s.total_amount,
  s.total_amount,
  'POSTED',
  s.created_by,
  s.created_by,
  s.validated_at
FROM sales s
JOIN accounting_journals j ON j.tenant_id = s.tenant_id AND j.journal_code = 'VEN'
WHERE s.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO')
ON CONFLICT (tenant_id, entry_number) DO NOTHING;

INSERT INTO journal_entry_lines(tenant_id, entry_id, account_id, debit, credit, description)
SELECT je.tenant_id, je.entry_id, coa.account_id, amount.debit, amount.credit, amount.description
FROM journal_entries je
JOIN sales s ON s.sale_id = je.reference_id AND je.reference_type = 'SALE'
JOIN LATERAL (
  VALUES
    ('57', s.customer_payable_amount, 0::NUMERIC, 'Encaissement patient'),
    ('41', s.insurance_covered_amount, 0::NUMERIC, 'Creance assurance'),
    ('70', 0::NUMERIC, s.total_amount, 'Ventes marchandises')
) AS amount(account_code, debit, credit, description) ON (amount.debit > 0 OR amount.credit > 0)
JOIN chart_of_accounts coa ON coa.tenant_id = je.tenant_id AND coa.account_code = amount.account_code
WHERE je.tenant_id = (SELECT tenant_id FROM tenants WHERE tenant_code = 'PHARMACIE_DEMO');

COMMIT;

SELECT
  t.tenant_code,
  s.site_name,
  (SELECT COUNT(*) FROM articles a WHERE a.tenant_id = t.tenant_id AND a.article_code LIKE 'PHD-%') AS produits,
  (SELECT COUNT(*) FROM suppliers sp WHERE sp.tenant_id = t.tenant_id AND sp.supplier_code LIKE 'PHD-FRN-%') AS fournisseurs,
  (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id AND c.customer_code LIKE 'PHD-CLI-%') AS clients,
  (SELECT COUNT(*) FROM sales sa WHERE sa.tenant_id = t.tenant_id) AS ventes,
  (SELECT COUNT(*) FROM accounts_receivable ar WHERE ar.tenant_id = t.tenant_id) AS creances,
  (SELECT COUNT(*) FROM stock_movements sm WHERE sm.tenant_id = t.tenant_id) AS stock_movements,
  (SELECT COUNT(*) FROM cash_movements cm WHERE cm.tenant_id = t.tenant_id) AS cash_movements
FROM tenants t
LEFT JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'PHD-KIN'
WHERE t.tenant_code = 'PHARMACIE_DEMO'
GROUP BY t.tenant_id, t.tenant_code, s.site_name;
