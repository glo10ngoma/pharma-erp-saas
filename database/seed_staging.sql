-- Seed STAGING V1
--
-- Aucun secret n'est stocke dans ce fichier.
-- Fournir le hash bcrypt admin au moment de l'execution :
--
--   psql "$DATABASE_URL" \
--     -v admin_password_hash='<bcrypt_hash_local_non_commite>' \
--     -f database/seed_staging.sql
--
-- Le mot de passe temporaire doit etre conserve uniquement localement
-- dans un gestionnaire de secrets ou une note non versionnee.

BEGIN;

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

INSERT INTO tenants (
  tenant_code,
  tenant_name,
  tenant_type,
  legal_name,
  phone,
  email,
  country,
  city,
  subscription_status,
  is_active
)
VALUES (
  'STAGING',
  'Pharmacie Staging',
  'PHARMACY',
  'Pharmacie Staging SARL',
  '+243000000100',
  'contact@staging.local',
  'RDC',
  'Kinshasa',
  'ACTIVE',
  TRUE
)
ON CONFLICT (tenant_code) DO UPDATE
SET tenant_name = EXCLUDED.tenant_name,
    subscription_status = EXCLUDED.subscription_status,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO sites (
  tenant_id,
  site_code,
  site_name,
  site_type,
  address,
  phone,
  is_active
)
SELECT
  t.tenant_id,
  'STG-MAIN',
  'Site Principal Staging',
  'PHARMACY',
  'Kinshasa',
  '+243000000101',
  TRUE
FROM tenants t
WHERE t.tenant_code = 'STAGING'
ON CONFLICT (site_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    site_name = EXCLUDED.site_name,
    is_active = EXCLUDED.is_active
WHERE sites.tenant_id = EXCLUDED.tenant_id
   OR sites.tenant_id IS NULL;

INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
VALUES
  ('articles.read', 'Consulter articles', 'Articles', 'Voir les articles', TRUE),
  ('articles.create', 'Creer article', 'Articles', 'Creer un article', TRUE),
  ('articles.update', 'Modifier article', 'Articles', 'Modifier un article', TRUE),
  ('articles.delete', 'Desactiver article', 'Articles', 'Desactiver un article', TRUE),
  ('attachments.read', 'Consulter pieces jointes', 'Attachments', 'Voir les pieces jointes', TRUE),
  ('audit.read', 'Consulter audit', 'Audit', 'Voir les journaux audit', TRUE),
  ('categories.read', 'Consulter categories', 'Categories', 'Voir les categories', TRUE),
  ('categories.create', 'Creer categorie', 'Categories', 'Creer une categorie', TRUE),
  ('categories.update', 'Modifier categorie', 'Categories', 'Modifier une categorie', TRUE),
  ('categories.delete', 'Desactiver categorie', 'Categories', 'Desactiver une categorie', TRUE),
  ('sub_categories.read', 'Consulter sous-categories', 'SubCategories', 'Voir les sous-categories', TRUE),
  ('sub_categories.create', 'Creer sous-categorie', 'SubCategories', 'Creer une sous-categorie', TRUE),
  ('sub_categories.update', 'Modifier sous-categorie', 'SubCategories', 'Modifier une sous-categorie', TRUE),
  ('sub_categories.delete', 'Desactiver sous-categorie', 'SubCategories', 'Desactiver une sous-categorie', TRUE),
  ('galenic_forms.read', 'Consulter formes', 'GalenicForms', 'Voir les formes galeniques', TRUE),
  ('galenic_forms.create', 'Creer forme', 'GalenicForms', 'Creer une forme galenique', TRUE),
  ('galenic_forms.update', 'Modifier forme', 'GalenicForms', 'Modifier une forme galenique', TRUE),
  ('galenic_forms.delete', 'Supprimer forme', 'GalenicForms', 'Supprimer une forme galenique', TRUE),
  ('administration_routes.read', 'Consulter voies', 'AdministrationRoutes', 'Voir les voies administration', TRUE),
  ('administration_routes.create', 'Creer voie', 'AdministrationRoutes', 'Creer une voie administration', TRUE),
  ('administration_routes.update', 'Modifier voie', 'AdministrationRoutes', 'Modifier une voie administration', TRUE),
  ('administration_routes.delete', 'Supprimer voie', 'AdministrationRoutes', 'Supprimer une voie administration', TRUE),
  ('product_types.read', 'Consulter types produits', 'ProductTypes', 'Voir les types produits', TRUE),
  ('product_types.create', 'Creer type produit', 'ProductTypes', 'Creer un type produit', TRUE),
  ('product_types.update', 'Modifier type produit', 'ProductTypes', 'Modifier un type produit', TRUE),
  ('product_types.delete', 'Supprimer type produit', 'ProductTypes', 'Supprimer un type produit', TRUE),
  ('suppliers.read', 'Consulter fournisseurs', 'Suppliers', 'Voir les fournisseurs', TRUE),
  ('suppliers.create', 'Creer fournisseur', 'Suppliers', 'Creer un fournisseur', TRUE),
  ('suppliers.update', 'Modifier fournisseur', 'Suppliers', 'Modifier un fournisseur', TRUE),
  ('suppliers.delete', 'Desactiver fournisseur', 'Suppliers', 'Desactiver un fournisseur', TRUE),
  ('customers.read', 'Consulter clients', 'Customers', 'Voir les clients', TRUE),
  ('customers.create', 'Creer client', 'Customers', 'Creer un client', TRUE),
  ('customers.update', 'Modifier client', 'Customers', 'Modifier un client', TRUE),
  ('customers.delete', 'Desactiver client', 'Customers', 'Desactiver un client', TRUE),
  ('disposals.read', 'Consulter sorties stock', 'Disposals', 'Voir les sorties stock', TRUE),
  ('purchases.read', 'Consulter achats', 'Purchases', 'Voir les achats', TRUE),
  ('purchases.create', 'Creer achat', 'Purchases', 'Creer un achat brouillon', TRUE),
  ('purchases.update_draft', 'Modifier achat brouillon', 'Purchases', 'Modifier un achat brouillon', TRUE),
  ('purchases.validate', 'Valider achat', 'Purchases', 'Valider un achat', TRUE),
  ('lots.read', 'Consulter lots', 'Lots', 'Voir les lots', TRUE),
  ('lots.block', 'Bloquer lot', 'Lots', 'Bloquer ou debloquer un lot', TRUE),
  ('stocks.read', 'Consulter stocks', 'Stocks', 'Voir les stocks', TRUE),
  ('stock_movements.read', 'Consulter mouvements stock', 'StockMovements', 'Voir les mouvements de stock', TRUE),
  ('sales.read', 'Consulter ventes', 'Sales', 'Voir les ventes', TRUE),
  ('sales.create', 'Creer vente', 'Sales', 'Creer une vente brouillon', TRUE),
  ('sales.update_draft', 'Modifier vente brouillon', 'Sales', 'Modifier une vente brouillon', TRUE),
  ('sales.validate', 'Valider vente', 'Sales', 'Valider une vente', TRUE),
  ('sales.cancel_draft', 'Annuler vente brouillon', 'Sales', 'Annuler une vente brouillon', TRUE),
  ('payments.read', 'Consulter paiements', 'Payments', 'Voir les paiements', TRUE),
  ('payments.create', 'Creer paiement', 'Payments', 'Creer un paiement', TRUE),
  ('cash_sessions.open', 'Ouvrir caisse', 'Cash', 'Ouvrir une session caisse', TRUE),
  ('cash_sessions.close', 'Fermer caisse', 'Cash', 'Fermer une session caisse', TRUE),
  ('cash_sessions.validate', 'Valider caisse', 'Cash', 'Valider une session caisse', TRUE),
  ('cash_movements.create', 'Creer mouvement caisse', 'Cash', 'Creer un mouvement caisse', TRUE),
  ('cash_expenses.create', 'Creer depense caisse', 'Cash', 'Creer une depense caisse', TRUE),
  ('cash_registers.read', 'Consulter caisse', 'Cash', 'Voir les caisses', TRUE),
  ('organizations.read', 'Consulter organisations', 'Organizations', 'Voir les organisations', TRUE),
  ('organizations.create', 'Creer organisation', 'Organizations', 'Creer une organisation', TRUE),
  ('organizations.update', 'Modifier organisation', 'Organizations', 'Modifier une organisation', TRUE),
  ('organizations.disable', 'Desactiver organisation', 'Organizations', 'Desactiver une organisation', TRUE),
  ('insurance_plans.read', 'Consulter plans assurance', 'InsurancePlans', 'Voir les plans assurance', TRUE),
  ('insurance_plans.create', 'Creer plan assurance', 'InsurancePlans', 'Creer un plan assurance', TRUE),
  ('insurance_plans.update', 'Modifier plan assurance', 'InsurancePlans', 'Modifier un plan assurance', TRUE),
  ('memberships.read', 'Consulter affiliations', 'Memberships', 'Voir les affiliations', TRUE),
  ('memberships.create', 'Creer affiliation', 'Memberships', 'Creer une affiliation', TRUE),
  ('memberships.update', 'Modifier affiliation', 'Memberships', 'Modifier une affiliation', TRUE),
  ('notifications.read', 'Consulter notifications', 'Notifications', 'Voir les notifications', TRUE),
  ('prescriptions.read', 'Consulter ordonnances', 'Prescriptions', 'Voir les ordonnances', TRUE),
  ('receivables.read', 'Consulter creances', 'Receivables', 'Voir les creances', TRUE),
  ('receivables.pay', 'Payer creance', 'Receivables', 'Enregistrer un paiement creance', TRUE),
  ('inventories.read', 'Consulter inventaires', 'Inventories', 'Voir les inventaires', TRUE),
  ('inventories.create', 'Creer inventaire', 'Inventories', 'Creer un inventaire', TRUE),
  ('inventories.start', 'Demarrer inventaire', 'Inventories', 'Demarrer un inventaire', TRUE),
  ('inventories.close', 'Cloturer inventaire', 'Inventories', 'Cloturer un inventaire', TRUE),
  ('inventories.validate', 'Valider inventaire', 'Inventories', 'Valider un inventaire', TRUE),
  ('stock_adjustments.read', 'Consulter ajustements stock', 'StockAdjustments', 'Voir les ajustements stock', TRUE),
  ('accounting.read', 'Consulter comptabilite', 'Accounting', 'Voir la comptabilite', TRUE),
  ('accounting.post', 'Poster ecriture', 'Accounting', 'Poster une ecriture', TRUE),
  ('accounting.manage_accounts', 'Gerer plan comptable', 'Accounting', 'Gerer comptes et journaux', TRUE),
  ('accounting.trial_balance', 'Consulter balance', 'Accounting', 'Voir la balance', TRUE),
  ('accounting.general_ledger', 'Consulter grand livre', 'Accounting', 'Voir le grand livre', TRUE),
  ('reports.dashboard', 'Consulter dashboard BI', 'Reports', 'Voir les KPIs', TRUE),
  ('reports.sales', 'Consulter rapports ventes', 'Reports', 'Voir les rapports ventes', TRUE),
  ('reports.stock', 'Consulter rapports stock', 'Reports', 'Voir les rapports stock', TRUE),
  ('reports.cash', 'Consulter rapports caisse', 'Reports', 'Voir les rapports caisse', TRUE),
  ('reports.receivables', 'Consulter rapports creances', 'Reports', 'Voir les rapports creances', TRUE),
  ('reports.expiry', 'Consulter rapports peremption', 'Reports', 'Voir les rapports peremption', TRUE),
  ('reports.margins', 'Consulter rapports marges', 'Reports', 'Voir les rapports marges', TRUE),
  ('reports.top_products', 'Consulter top produits', 'Reports', 'Voir les produits les plus vendus', TRUE),
  ('settings.exchange_rate.read', 'Consulter taux de change', 'Settings', 'Voir le taux USD/CDF du tenant', TRUE),
  ('settings.exchange_rate.update', 'Modifier taux de change', 'Settings', 'Modifier le taux USD/CDF du tenant', TRUE),
  ('users.read', 'Consulter utilisateurs', 'Users', 'Voir les utilisateurs', TRUE),
  ('users.create', 'Creer utilisateur', 'Users', 'Creer un utilisateur', TRUE),
  ('users.update', 'Modifier utilisateur', 'Users', 'Modifier un utilisateur', TRUE),
  ('users.delete', 'Desactiver utilisateur', 'Users', 'Desactiver un utilisateur', TRUE),
  ('roles.read', 'Consulter roles', 'Roles', 'Voir les roles', TRUE),
  ('roles.create', 'Creer role', 'Roles', 'Creer un role', TRUE),
  ('roles.update', 'Modifier role', 'Roles', 'Modifier un role', TRUE),
  ('roles.delete', 'Desactiver role', 'Roles', 'Desactiver un role', TRUE),
  ('roles.assign_permissions', 'Affecter permissions role', 'Roles', 'Affecter les permissions', TRUE),
  ('permissions.read', 'Consulter permissions', 'Permissions', 'Voir les permissions', TRUE),
  ('permissions.create', 'Creer permission', 'Permissions', 'Creer une permission', TRUE),
  ('permissions.update', 'Modifier permission', 'Permissions', 'Modifier une permission', TRUE),
  ('permissions.delete', 'Supprimer permission', 'Permissions', 'Supprimer une permission', TRUE),
  ('sites.read', 'Consulter sites', 'Sites', 'Voir les sites', TRUE),
  ('sites.create', 'Creer site', 'Sites', 'Creer un site', TRUE),
  ('sites.update', 'Modifier site', 'Sites', 'Modifier un site', TRUE),
  ('sites.delete', 'Desactiver site', 'Sites', 'Desactiver un site', TRUE),
  ('tenants.read', 'Consulter tenants', 'Tenants', 'Voir les tenants', TRUE),
  ('transfers.read', 'Consulter transferts', 'Transfers', 'Voir les transferts', TRUE),
  ('transfers.create', 'Creer transfert', 'Transfers', 'Creer un transfert brouillon', TRUE),
  ('transfers.update_draft', 'Modifier transfert brouillon', 'Transfers', 'Ajouter ou supprimer des lignes transfert', TRUE),
  ('transfers.validate', 'Valider transfert', 'Transfers', 'Valider un transfert et creer les mouvements stock', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = EXCLUDED.is_system_permission;

INSERT INTO roles (
  tenant_id,
  role_name,
  description,
  is_active
)
SELECT
  t.tenant_id,
  'ADMIN',
  'Administrateur staging',
  TRUE
FROM tenants t
WHERE t.tenant_code = 'STAGING'
ON CONFLICT (tenant_id, role_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
JOIN permissions p ON p.permission_code IN (
  'articles.read','articles.create','articles.update','articles.delete',
  'attachments.read','audit.read',
  'categories.read','categories.create','categories.update','categories.delete',
  'sub_categories.read','sub_categories.create','sub_categories.update','sub_categories.delete',
  'galenic_forms.read','galenic_forms.create','galenic_forms.update','galenic_forms.delete',
  'administration_routes.read','administration_routes.create','administration_routes.update','administration_routes.delete',
  'product_types.read','product_types.create','product_types.update','product_types.delete',
  'suppliers.read','suppliers.create','suppliers.update','suppliers.delete',
  'customers.read','customers.create','customers.update','customers.delete',
  'disposals.read',
  'purchases.read','purchases.create','purchases.update_draft','purchases.validate',
  'lots.read','lots.block','stocks.read','stock_movements.read',
  'sales.read','sales.create','sales.update_draft','sales.validate','sales.cancel_draft',
  'payments.read','payments.create',
  'cash_sessions.open','cash_sessions.close','cash_sessions.validate','cash_movements.create','cash_expenses.create','cash_registers.read',
  'organizations.read','organizations.create','organizations.update','organizations.disable',
  'insurance_plans.read','insurance_plans.create','insurance_plans.update',
  'memberships.read','memberships.create','memberships.update',
  'notifications.read','prescriptions.read',
  'receivables.read','receivables.pay',
  'inventories.read','inventories.create','inventories.start','inventories.close','inventories.validate',
  'stock_adjustments.read',
  'accounting.read','accounting.post','accounting.manage_accounts','accounting.trial_balance','accounting.general_ledger',
  'reports.dashboard','reports.sales','reports.stock','reports.cash','reports.receivables','reports.expiry','reports.margins','reports.top_products',
  'settings.exchange_rate.read','settings.exchange_rate.update',
  'users.read','users.create','users.update','users.delete',
  'roles.read','roles.create','roles.update','roles.delete','roles.assign_permissions',
  'permissions.read','permissions.create','permissions.update','permissions.delete',
  'sites.read','sites.create','sites.update','sites.delete',
  'tenants.read','transfers.read','transfers.create','transfers.update_draft','transfers.validate'
)
WHERE t.tenant_code = 'STAGING'
  AND r.role_name = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

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
WHERE t.tenant_code = 'STAGING'
ON CONFLICT (tenant_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO payment_methods(method_code, method_name, is_active)
VALUES ('CASH', 'Cash', TRUE)
ON CONFLICT (method_code) DO UPDATE
SET method_name = EXCLUDED.method_name,
    is_active = EXCLUDED.is_active;

INSERT INTO cash_registers (
  tenant_id,
  site_id,
  register_code,
  register_name,
  currency_id,
  is_active
)
SELECT
  t.tenant_id,
  s.site_id,
  'MAIN',
  'Caisse principale staging',
  c.currency_id,
  TRUE
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'STG-MAIN'
JOIN currencies c ON c.currency_code = 'USD'
WHERE t.tenant_code = 'STAGING'
ON CONFLICT (tenant_id, site_id, register_code) DO UPDATE
SET register_name = EXCLUDED.register_name,
    currency_id = EXCLUDED.currency_id,
    is_active = EXCLUDED.is_active;

INSERT INTO users (
  tenant_id,
  site_id,
  role_id,
  full_name,
  username,
  email,
  phone,
  password_hash,
  is_active
)
SELECT
  t.tenant_id,
  s.site_id,
  r.role_id,
  'Admin Staging',
  'admin.staging',
  'admin@staging.local',
  '+243000000102',
  :'admin_password_hash',
  TRUE
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'STG-MAIN'
JOIN roles r ON r.tenant_id = t.tenant_id AND r.role_name = 'ADMIN'
WHERE t.tenant_code = 'STAGING'
ON CONFLICT (username) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    site_id = EXCLUDED.site_id,
    role_id = EXCLUDED.role_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active
WHERE users.tenant_id = EXCLUDED.tenant_id
   OR users.tenant_id IS NULL;

INSERT INTO articles (
  tenant_id,
  article_code,
  commercial_name,
  dci,
  dosage,
  prescription_required,
  default_stock_min,
  default_stock_max,
  is_active
)
SELECT
  t.tenant_id,
  data.article_code,
  data.commercial_name,
  data.dci,
  data.dosage,
  data.prescription_required,
  data.default_stock_min,
  data.default_stock_max,
  TRUE
FROM tenants t
CROSS JOIN (
  VALUES
    ('STG-PARA-500', 'Paracetamol Demo 500 mg', 'Paracetamol', '500 mg', FALSE, 10, 200),
    ('STG-AMOX-500', 'Amoxicilline Demo 500 mg', 'Amoxicilline', '500 mg', TRUE, 8, 150),
    ('STG-ORS-SACHET', 'SRO Demo Sachet', 'Sels de rehydratation orale', 'Sachet', FALSE, 20, 300),
    ('STG-ALCOOL-70', 'Alcool Demo 70%', 'Ethanol', '70%', FALSE, 5, 100)
) AS data(article_code, commercial_name, dci, dosage, prescription_required, default_stock_min, default_stock_max)
WHERE t.tenant_code = 'STAGING'
ON CONFLICT (tenant_id, article_code) DO UPDATE
SET commercial_name = EXCLUDED.commercial_name,
    dci = EXCLUDED.dci,
    dosage = EXCLUDED.dosage,
    prescription_required = EXCLUDED.prescription_required,
    default_stock_min = EXCLUDED.default_stock_min,
    default_stock_max = EXCLUDED.default_stock_max,
    is_active = EXCLUDED.is_active;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'STAGING'
),
product_type_data(type_code, type_name) AS (
  VALUES
    ('STG-CAT-MED', 'Medicament'),
    ('STG-CAT-SUPP', 'Supplement'),
    ('STG-CAT-PARA', 'Parapharmacie'),
    ('STG-CAT-DM', 'Dispositif medical')
)
INSERT INTO product_types (tenant_id, type_code, type_name)
SELECT t.tenant_id, d.type_code, d.type_name
FROM target_tenant t
CROSS JOIN product_type_data d
ON CONFLICT (type_name) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    type_code = EXCLUDED.type_code;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'STAGING'
),
category_data(category_code, category_name) AS (
  VALUES
    ('STG-CAT-ANTALG', 'Antalgiques et antipyretiques'),
    ('STG-CAT-ATB', 'Antibiotiques'),
    ('STG-CAT-PALU', 'Antipaludiques'),
    ('STG-CAT-GASTRO', 'Gastro-enterologie'),
    ('STG-CAT-DIAB', 'Diabete'),
    ('STG-CAT-CARDIO', 'Cardiologie'),
    ('STG-CAT-ANTISEP', 'Antiseptiques'),
    ('STG-CAT-DM-CAT', 'Dispositifs medicaux')
)
INSERT INTO categories (tenant_id, category_code, category_name, is_active)
SELECT t.tenant_id, d.category_code, d.category_name, TRUE
FROM target_tenant t
CROSS JOIN category_data d
ON CONFLICT (category_name) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    category_code = EXCLUDED.category_code,
    is_active = EXCLUDED.is_active;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'STAGING'
),
sub_category_data(category_code, sub_category_code, sub_category_name) AS (
  VALUES
    ('STG-CAT-ANTALG', 'STG-CAT-ANTALG-SIMPLE', 'Antalgiques simples'),
    ('STG-CAT-ATB', 'STG-CAT-ATB-PEN', 'Penicillines'),
    ('STG-CAT-ATB', 'STG-CAT-ATB-MAC', 'Macrolides'),
    ('STG-CAT-PALU', 'STG-CAT-PALU-ACT', 'ACT'),
    ('STG-CAT-GASTRO', 'STG-CAT-GASTRO-ORS', 'Rehydratation orale'),
    ('STG-CAT-GASTRO', 'STG-CAT-GASTRO-IPP', 'IPP'),
    ('STG-CAT-DIAB', 'STG-CAT-DIAB-BIG', 'Antidiabetiques oraux'),
    ('STG-CAT-CARDIO', 'STG-CAT-CARDIO-HTA', 'Antihypertenseurs'),
    ('STG-CAT-ANTISEP', 'STG-CAT-ANTISEP-DESINF', 'Desinfection'),
    ('STG-CAT-DM-CAT', 'STG-CAT-DM-PROT', 'Protection')
)
INSERT INTO sub_categories (tenant_id, category_id, sub_category_code, sub_category_name, is_active)
SELECT t.tenant_id, c.category_id, d.sub_category_code, d.sub_category_name, TRUE
FROM target_tenant t
JOIN sub_category_data d ON TRUE
JOIN categories c ON c.tenant_id = t.tenant_id AND c.category_code = d.category_code
ON CONFLICT (category_id, sub_category_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    sub_category_name = EXCLUDED.sub_category_name,
    is_active = EXCLUDED.is_active;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'STAGING'
),
form_data(form_code, form_name) AS (
  VALUES
    ('STG-CAT-COMP', 'Comprime'),
    ('STG-CAT-GEL', 'Gelule'),
    ('STG-CAT-SACHET', 'Sachet'),
    ('STG-CAT-SOL', 'Solution'),
    ('STG-CAT-GANTS', 'Gants')
)
INSERT INTO galenic_forms (tenant_id, form_code, form_name)
SELECT t.tenant_id, d.form_code, d.form_name
FROM target_tenant t
CROSS JOIN form_data d
ON CONFLICT (form_name) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    form_code = EXCLUDED.form_code;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'STAGING'
),
route_data(route_code, route_name) AS (
  VALUES
    ('STG-CAT-ORAL', 'Orale'),
    ('STG-CAT-CUT', 'Cutanee')
)
INSERT INTO administration_routes (tenant_id, route_code, route_name)
SELECT t.tenant_id, d.route_code, d.route_name
FROM target_tenant t
CROSS JOIN route_data d
ON CONFLICT (route_name) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    route_code = EXCLUDED.route_code;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'STAGING'
),
article_data(article_code, commercial_name, dci, dosage, category_code, sub_category_code, form_code, route_code, type_code, atc_code, prescription_required, stock_min) AS (
  VALUES
    ('STG-CAT-PARA-500', 'Paracetamol 500 mg comprime', 'Paracetamol', '500 mg', 'STG-CAT-ANTALG', 'STG-CAT-ANTALG-SIMPLE', 'STG-CAT-COMP', 'STG-CAT-ORAL', 'STG-CAT-MED', 'N02BE01', FALSE, 20),
    ('STG-CAT-AMOX-500', 'Amoxicilline 500 mg gelule', 'Amoxicilline', '500 mg', 'STG-CAT-ATB', 'STG-CAT-ATB-PEN', 'STG-CAT-GEL', 'STG-CAT-ORAL', 'STG-CAT-MED', 'J01CA04', TRUE, 10),
    ('STG-CAT-AZI-500', 'Azithromycine 500 mg comprime', 'Azithromycine', '500 mg', 'STG-CAT-ATB', 'STG-CAT-ATB-MAC', 'STG-CAT-COMP', 'STG-CAT-ORAL', 'STG-CAT-MED', 'J01FA10', TRUE, 8),
    ('STG-CAT-ART-LUM', 'Artemether Lumefantrine 20/120 mg', 'Artemether + Lumefantrine', '20 mg + 120 mg', 'STG-CAT-PALU', 'STG-CAT-PALU-ACT', 'STG-CAT-COMP', 'STG-CAT-ORAL', 'STG-CAT-MED', 'P01BF01', TRUE, 20),
    ('STG-CAT-ORS-SACHET', 'SRO sachet', 'Sels de rehydratation orale', 'Sachet', 'STG-CAT-GASTRO', 'STG-CAT-GASTRO-ORS', 'STG-CAT-SACHET', 'STG-CAT-ORAL', 'STG-CAT-MED', 'A07CA', FALSE, 30),
    ('STG-CAT-OMEP-20', 'Omeprazole 20 mg gelule', 'Omeprazole', '20 mg', 'STG-CAT-GASTRO', 'STG-CAT-GASTRO-IPP', 'STG-CAT-GEL', 'STG-CAT-ORAL', 'STG-CAT-MED', 'A02BC01', FALSE, 15),
    ('STG-CAT-METF-500', 'Metformine 500 mg comprime', 'Metformine', '500 mg', 'STG-CAT-DIAB', 'STG-CAT-DIAB-BIG', 'STG-CAT-COMP', 'STG-CAT-ORAL', 'STG-CAT-MED', 'A10BA02', TRUE, 10),
    ('STG-CAT-AMLO-5', 'Amlodipine 5 mg comprime', 'Amlodipine', '5 mg', 'STG-CAT-CARDIO', 'STG-CAT-CARDIO-HTA', 'STG-CAT-COMP', 'STG-CAT-ORAL', 'STG-CAT-MED', 'C08CA01', TRUE, 10),
    ('STG-CAT-ALCOOL-70', 'Alcool 70 pour cent', 'Ethanol', '70%', 'STG-CAT-ANTISEP', 'STG-CAT-ANTISEP-DESINF', 'STG-CAT-SOL', 'STG-CAT-CUT', 'STG-CAT-PARA', 'D08AX08', FALSE, 10),
    ('STG-CAT-GANTS-MED', 'Gants medicaux non steriles', NULL, 'Taille M', 'STG-CAT-DM-CAT', 'STG-CAT-DM-PROT', 'STG-CAT-GANTS', 'STG-CAT-CUT', 'STG-CAT-DM', NULL, FALSE, 50)
)
INSERT INTO articles (
  tenant_id, article_code, commercial_name, dci, dosage, category_id, sub_category_id,
  form_id, route_id, product_type_id, atc_code, prescription_required, default_stock_min, is_active
)
SELECT
  t.tenant_id, d.article_code, d.commercial_name, d.dci, d.dosage, c.category_id, sc.sub_category_id,
  gf.form_id, ar.route_id, pt.product_type_id, d.atc_code, d.prescription_required, d.stock_min, TRUE
FROM target_tenant t
JOIN article_data d ON TRUE
JOIN categories c ON c.tenant_id = t.tenant_id AND c.category_code = d.category_code
JOIN sub_categories sc ON sc.tenant_id = t.tenant_id AND sc.sub_category_code = d.sub_category_code
JOIN galenic_forms gf ON gf.tenant_id = t.tenant_id AND gf.form_code = d.form_code
JOIN administration_routes ar ON ar.tenant_id = t.tenant_id AND ar.route_code = d.route_code
JOIN product_types pt ON pt.tenant_id = t.tenant_id AND pt.type_code = d.type_code
ON CONFLICT (article_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    commercial_name = EXCLUDED.commercial_name,
    dci = EXCLUDED.dci,
    dosage = EXCLUDED.dosage,
    category_id = EXCLUDED.category_id,
    sub_category_id = EXCLUDED.sub_category_id,
    form_id = EXCLUDED.form_id,
    route_id = EXCLUDED.route_id,
    product_type_id = EXCLUDED.product_type_id,
    atc_code = EXCLUDED.atc_code,
    prescription_required = EXCLUDED.prescription_required,
    default_stock_min = EXCLUDED.default_stock_min,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;
