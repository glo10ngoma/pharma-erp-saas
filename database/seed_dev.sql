-- Seed DEV - Auth + Articles
-- Identifiants locaux :
--   email: admin@demo.local
--   password: admin123
--
-- A executer apres database/schema.sql sur une base de developpement.

BEGIN;

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
  'DEMO',
  'Pharmacie Demo',
  'PHARMACY',
  'Pharmacie Demo SARL',
  '+243000000000',
  'contact@demo.local',
  'RDC',
  'Kinshasa',
  'ACTIVE',
  TRUE
)
ON CONFLICT (tenant_code) DO UPDATE
SET
  tenant_name = EXCLUDED.tenant_name,
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
  'DEMO-SITE',
  'Site Demo Kinshasa',
  'PHARMACY',
  'Kinshasa',
  '+243000000001',
  TRUE
FROM tenants t
WHERE t.tenant_code = 'DEMO'
ON CONFLICT (site_code) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
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
  ('articles.read', 'Consulter articles', 'Articles', 'Voir la liste et le detail des articles', TRUE),
  ('articles.create', 'Creer article', 'Articles', 'Creer un nouvel article', TRUE),
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
  ('purchases.update_draft', 'Modifier achat brouillon', 'Purchases', 'Modifier un achat en brouillon', TRUE),
  ('purchases.validate', 'Valider achat', 'Purchases', 'Valider un achat et alimenter le stock', TRUE),
  ('lots.read', 'Consulter lots', 'Lots', 'Voir les lots', TRUE),
  ('lots.block', 'Bloquer lot', 'Lots', 'Bloquer ou debloquer un lot', TRUE),
  ('stocks.read', 'Consulter stocks', 'Stocks', 'Voir les stocks', TRUE),
  ('stock_movements.read', 'Consulter mouvements stock', 'StockMovements', 'Voir les mouvements de stock', TRUE),
  ('sales.read', 'Consulter ventes', 'Sales', 'Voir les ventes', TRUE),
  ('sales.create', 'Creer vente', 'Sales', 'Creer une vente brouillon', TRUE),
  ('sales.update_draft', 'Modifier vente brouillon', 'Sales', 'Modifier une vente brouillon', TRUE),
  ('sales.validate', 'Valider vente', 'Sales', 'Valider une vente CASH', TRUE),
  ('sales.cancel_draft', 'Annuler vente brouillon', 'Sales', 'Annuler une vente brouillon', TRUE),
  ('payments.read', 'Consulter paiements', 'Payments', 'Voir les paiements', TRUE),
  ('payments.create', 'Creer paiement', 'Payments', 'Creer un paiement', TRUE),
  ('cash_sessions.open', 'Ouvrir caisse', 'Cash', 'Ouvrir une session caisse', TRUE),
  ('cash_sessions.close', 'Fermer caisse', 'Cash', 'Fermer une session caisse', TRUE),
  ('cash_sessions.validate', 'Valider caisse', 'Cash', 'Valider une session caisse', TRUE),
  ('cash_movements.create', 'Creer mouvement caisse', 'Cash', 'Creer un mouvement de caisse', TRUE),
  ('cash_expenses.create', 'Creer depense caisse', 'Cash', 'Creer une depense de caisse', TRUE),
  ('cash_registers.read', 'Consulter caisse', 'Cash', 'Voir les sessions et mouvements de caisse', TRUE),
  ('organizations.read', 'Consulter organisations', 'Organizations', 'Voir les organisations partenaires', TRUE),
  ('organizations.create', 'Creer organisation', 'Organizations', 'Creer une organisation partenaire', TRUE),
  ('organizations.update', 'Modifier organisation', 'Organizations', 'Modifier une organisation partenaire', TRUE),
  ('organizations.disable', 'Desactiver organisation', 'Organizations', 'Desactiver une organisation partenaire', TRUE),
  ('insurance_plans.read', 'Consulter plans assurance', 'InsurancePlans', 'Voir les plans assurance', TRUE),
  ('insurance_plans.create', 'Creer plan assurance', 'InsurancePlans', 'Creer un plan assurance', TRUE),
  ('insurance_plans.update', 'Modifier plan assurance', 'InsurancePlans', 'Modifier un plan assurance', TRUE),
  ('memberships.read', 'Consulter affiliations', 'Memberships', 'Voir les affiliations clients', TRUE),
  ('memberships.create', 'Creer affiliation', 'Memberships', 'Creer une affiliation client', TRUE),
  ('memberships.update', 'Modifier affiliation', 'Memberships', 'Modifier une affiliation client', TRUE),
  ('notifications.read', 'Consulter notifications', 'Notifications', 'Voir les notifications', TRUE),
  ('prescriptions.read', 'Consulter ordonnances', 'Prescriptions', 'Voir les ordonnances', TRUE),
  ('receivables.read', 'Consulter creances', 'Receivables', 'Voir les creances', TRUE),
  ('receivables.pay', 'Payer creance', 'Receivables', 'Enregistrer un paiement de creance', TRUE),
  ('inventories.read', 'Consulter inventaires', 'Inventories', 'Voir les inventaires physiques', TRUE),
  ('inventories.create', 'Creer inventaire', 'Inventories', 'Creer un inventaire physique', TRUE),
  ('inventories.start', 'Demarrer inventaire', 'Inventories', 'Demarrer et saisir un inventaire physique', TRUE),
  ('inventories.close', 'Cloturer inventaire', 'Inventories', 'Cloturer un inventaire physique', TRUE),
  ('inventories.validate', 'Valider inventaire', 'Inventories', 'Valider les ecarts inventaire', TRUE),
  ('stock_adjustments.read', 'Consulter ajustements stock', 'StockAdjustments', 'Voir les ajustements de stock', TRUE),
  ('accounting.read', 'Consulter comptabilite', 'Accounting', 'Voir comptes, journaux et ecritures', TRUE),
  ('accounting.post', 'Poster ecriture', 'Accounting', 'Poster une ecriture comptable', TRUE),
  ('accounting.manage_accounts', 'Gerer plan comptable', 'Accounting', 'Creer comptes et journaux', TRUE),
  ('accounting.trial_balance', 'Consulter balance', 'Accounting', 'Voir la balance comptable', TRUE),
  ('accounting.general_ledger', 'Consulter grand livre', 'Accounting', 'Voir le grand livre comptable', TRUE),
  ('reports.dashboard', 'Consulter dashboard BI', 'Reports', 'Voir les KPIs dashboard', TRUE),
  ('reports.sales', 'Consulter rapports ventes', 'Reports', 'Voir les rapports de ventes et top produits', TRUE),
  ('reports.stock', 'Consulter rapports stock', 'Reports', 'Voir les valeurs de stock', TRUE),
  ('reports.cash', 'Consulter rapports caisse', 'Reports', 'Voir les encaissements caisse', TRUE),
  ('reports.receivables', 'Consulter rapports creances', 'Reports', 'Voir les creances ouvertes', TRUE),
  ('reports.expiry', 'Consulter rapports peremption', 'Reports', 'Voir les lots expires et proches peremption', TRUE),
  ('reports.margins', 'Consulter rapports marges', 'Reports', 'Voir les marges brutes estimees', TRUE),
  ('reports.top_products', 'Consulter top produits', 'Reports', 'Voir les produits les plus vendus', TRUE),
  ('users.read', 'Consulter utilisateurs', 'Users', 'Voir les utilisateurs du tenant', TRUE),
  ('users.create', 'Creer utilisateur', 'Users', 'Creer un utilisateur du tenant', TRUE),
  ('users.update', 'Modifier utilisateur', 'Users', 'Modifier un utilisateur du tenant', TRUE),
  ('users.delete', 'Desactiver utilisateur', 'Users', 'Desactiver un utilisateur du tenant', TRUE),
  ('roles.read', 'Consulter roles', 'Roles', 'Voir les roles du tenant', TRUE),
  ('roles.create', 'Creer role', 'Roles', 'Creer un role du tenant', TRUE),
  ('roles.update', 'Modifier role', 'Roles', 'Modifier un role du tenant', TRUE),
  ('roles.delete', 'Desactiver role', 'Roles', 'Desactiver un role du tenant', TRUE),
  ('roles.assign_permissions', 'Affecter permissions role', 'Roles', 'Remplacer les permissions affectees a un role', TRUE),
  ('permissions.read', 'Consulter permissions', 'Permissions', 'Voir les permissions disponibles', TRUE),
  ('permissions.create', 'Creer permission', 'Permissions', 'Creer une permission', TRUE),
  ('permissions.update', 'Modifier permission', 'Permissions', 'Modifier une permission', TRUE),
  ('permissions.delete', 'Supprimer permission', 'Permissions', 'Supprimer une permission non liee', TRUE),
  ('sites.read', 'Consulter sites', 'Sites', 'Voir les sites du tenant', TRUE),
  ('sites.create', 'Creer site', 'Sites', 'Creer un site du tenant', TRUE),
  ('sites.update', 'Modifier site', 'Sites', 'Modifier un site du tenant', TRUE),
  ('sites.delete', 'Desactiver site', 'Sites', 'Desactiver un site du tenant', TRUE),
  ('tenants.read', 'Consulter tenants', 'Tenants', 'Voir les tenants', TRUE),
  ('transfers.read', 'Consulter transferts', 'Transfers', 'Voir les transferts', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET
  permission_name = EXCLUDED.permission_name,
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
  'Administrateur demo',
  TRUE
FROM tenants t
WHERE t.tenant_code = 'DEMO'
ON CONFLICT (role_name) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
JOIN permissions p ON p.permission_code IN (
  'articles.read',
  'articles.create',
  'articles.update',
  'articles.delete',
  'attachments.read',
  'audit.read',
  'categories.read',
  'categories.create',
  'categories.update',
  'categories.delete',
  'sub_categories.read',
  'sub_categories.create',
  'sub_categories.update',
  'sub_categories.delete',
  'galenic_forms.read',
  'galenic_forms.create',
  'galenic_forms.update',
  'galenic_forms.delete',
  'administration_routes.read',
  'administration_routes.create',
  'administration_routes.update',
  'administration_routes.delete',
  'product_types.read',
  'product_types.create',
  'product_types.update',
  'product_types.delete',
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'suppliers.delete',
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.delete',
  'disposals.read',
  'purchases.read',
  'purchases.create',
  'purchases.update_draft',
  'purchases.validate',
  'lots.read',
  'lots.block',
  'stocks.read',
  'stock_movements.read',
  'sales.read',
  'sales.create',
  'sales.update_draft',
  'sales.validate',
  'sales.cancel_draft',
  'payments.read',
  'payments.create',
  'cash_sessions.open',
  'cash_sessions.close',
  'cash_sessions.validate',
  'cash_movements.create',
  'cash_expenses.create',
  'cash_registers.read',
  'organizations.read',
  'organizations.create',
  'organizations.update',
  'organizations.disable',
  'insurance_plans.read',
  'insurance_plans.create',
  'insurance_plans.update',
  'memberships.read',
  'memberships.create',
  'memberships.update',
  'notifications.read',
  'prescriptions.read',
  'receivables.read',
  'receivables.pay',
  'inventories.read',
  'inventories.create',
  'inventories.start',
  'inventories.close',
  'inventories.validate',
  'stock_adjustments.read',
  'accounting.read',
  'accounting.post',
  'accounting.manage_accounts',
  'accounting.trial_balance',
  'accounting.general_ledger',
  'reports.dashboard',
  'reports.sales',
  'reports.stock',
  'reports.cash',
  'reports.receivables',
  'reports.expiry',
  'reports.margins',
  'reports.top_products',
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'roles.assign_permissions',
  'permissions.read',
  'permissions.create',
  'permissions.update',
  'permissions.delete',
  'sites.read',
  'sites.create',
  'sites.update',
  'sites.delete',
  'tenants.read',
  'transfers.read'
)
WHERE t.tenant_code = 'DEMO'
  AND r.role_name = 'ADMIN'
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
SELECT
  t.tenant_id,
  s.site_id,
  'MAIN',
  'Caisse principale',
  c.currency_id,
  TRUE
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'DEMO-SITE'
JOIN currencies c ON c.currency_code = 'USD'
WHERE t.tenant_code = 'DEMO'
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
  'Admin Demo',
  'admin.demo',
  'admin@demo.local',
  '+243000000002',
  '$2a$10$jLWOKu8vOzTT4wdtbCuMc.Bd1bx1KLzC.6yndJEcoDjzu9NU.xkCW',
  TRUE
FROM tenants t
JOIN sites s ON s.tenant_id = t.tenant_id AND s.site_code = 'DEMO-SITE'
JOIN roles r ON r.tenant_id = t.tenant_id AND r.role_name = 'ADMIN'
WHERE t.tenant_code = 'DEMO'
ON CONFLICT (username) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  site_id = EXCLUDED.site_id,
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  is_active = EXCLUDED.is_active
WHERE users.tenant_id = EXCLUDED.tenant_id
   OR users.tenant_id IS NULL;

COMMIT;
