-- Seed STAGING V1 - Supabase SQL Editor
--
-- 1. Generer un hash bcrypt localement.
-- 2. Remplacer __BCRYPT_HASH__ ci-dessous par le hash bcrypt.
-- 3. Executer tout ce fichier dans Supabase SQL Editor.
--
-- Ne jamais mettre le mot de passe temporaire dans ce fichier.
-- Ne jamais commiter un hash reel dans ce fichier.

BEGIN;

DO $$
BEGIN
  IF left('__BCRYPT_HASH__', 2) <> '$2' THEN
    RAISE EXCEPTION 'Remplacez __BCRYPT_HASH__ par un hash bcrypt avant execution.';
  END IF;
END $$;

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
    tenant_type = EXCLUDED.tenant_type,
    legal_name = EXCLUDED.legal_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
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
(
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
)
ON CONFLICT (site_code) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    site_name = EXCLUDED.site_name,
    site_type = EXCLUDED.site_type,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    is_active = EXCLUDED.is_active;

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
  ('transfers.read', 'Consulter transferts', 'Transfers', 'Voir les transferts', TRUE)
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
(
SELECT
  t.tenant_id,
  'ADMIN',
  'Administrateur staging',
  TRUE
FROM tenants t
WHERE t.tenant_code = 'STAGING'
)
ON CONFLICT (role_name) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO role_permissions (role_id, permission_id)
(
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
  'users.read','users.create','users.update','users.delete',
  'roles.read','roles.create','roles.update','roles.delete','roles.assign_permissions',
  'permissions.read','permissions.create','permissions.update','permissions.delete',
  'sites.read','sites.create','sites.update','sites.delete',
  'tenants.read','transfers.read'
)
WHERE t.tenant_code = 'STAGING'
  AND r.role_name = 'ADMIN'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO currencies(currency_code, currency_name, is_default)
VALUES
  ('USD', 'Dollar americain ($)', TRUE),
  ('CDF', 'Franc congolais (FC)', FALSE)
ON CONFLICT (currency_code) DO UPDATE
SET currency_name = EXCLUDED.currency_name,
    is_default = EXCLUDED.is_default;

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
(
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
)
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
(
SELECT
  t.tenant_id,
  s.site_id,
  r.role_id,
  'Admin Staging',
  'admin.staging',
  'admin@staging.local',
  '+243000000102',
  '__BCRYPT_HASH__',
  TRUE
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'STG-MAIN'
JOIN roles r ON r.tenant_id = t.tenant_id AND r.role_name = 'ADMIN'
WHERE t.tenant_code = 'STAGING'
)
ON CONFLICT (username) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    site_id = EXCLUDED.site_id,
    role_id = EXCLUDED.role_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    password_hash = EXCLUDED.password_hash,
    is_active = EXCLUDED.is_active;

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
(
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
)
ON CONFLICT (tenant_id, article_code) DO UPDATE
SET commercial_name = EXCLUDED.commercial_name,
    dci = EXCLUDED.dci,
    dosage = EXCLUDED.dosage,
    prescription_required = EXCLUDED.prescription_required,
    default_stock_min = EXCLUDED.default_stock_min,
    default_stock_max = EXCLUDED.default_stock_max,
    is_active = EXCLUDED.is_active;

COMMIT;

SELECT
  t.tenant_code,
  s.site_code,
  r.role_name,
  u.email AS admin_email,
  COUNT(DISTINCT a.article_id) AS demo_articles
FROM tenants t
LEFT JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'STG-MAIN'
LEFT JOIN roles r ON r.tenant_id = t.tenant_id AND r.role_name = 'ADMIN'
LEFT JOIN users u ON u.tenant_id = t.tenant_id AND u.email = 'admin@staging.local'
LEFT JOIN articles a ON a.tenant_id = t.tenant_id AND a.article_code LIKE 'STG-%'
WHERE t.tenant_code = 'STAGING'
GROUP BY t.tenant_code, s.site_code, r.role_name, u.email;
