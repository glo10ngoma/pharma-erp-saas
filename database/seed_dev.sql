-- Seed DEV - Auth + Articles
-- Identifiants locaux :
--   email: admin@demo.local
--   password: admin123
--
-- A executer apres database/schema.sql sur une base de developpement.

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
  ('product_units.read', 'Consulter unites produit', 'ArticleReferences', 'Voir les unites produit', TRUE),
  ('product_units.create', 'Creer unite produit', 'ArticleReferences', 'Creer une unite produit', TRUE),
  ('dosages.read', 'Consulter dosages', 'ArticleReferences', 'Voir les dosages', TRUE),
  ('dosages.create', 'Creer dosage', 'ArticleReferences', 'Creer un dosage', TRUE),
  ('active_ingredients.read', 'Consulter DCI', 'ArticleReferences', 'Voir les DCI', TRUE),
  ('active_ingredients.create', 'Creer DCI', 'ArticleReferences', 'Creer une DCI', TRUE),
  ('atc_codes.read', 'Consulter codes ATC', 'ArticleReferences', 'Voir les codes ATC', TRUE),
  ('atc_codes.create', 'Creer code ATC', 'ArticleReferences', 'Creer un code ATC', TRUE),
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
  ('purchases.pay', 'Payer achat fournisseur', 'Purchases', 'Enregistrer un paiement fournisseur pour un achat', TRUE),
  ('purchase_payments.read', 'Consulter paiements achat', 'Purchases', 'Voir l historique des paiements fournisseur', TRUE),
  ('purchase_attachments.read', 'Consulter pieces jointes achat', 'Purchases', 'Voir les pieces jointes des achats et retours fournisseur', TRUE),
  ('purchase_attachments.create', 'Ajouter piece jointe achat', 'Purchases', 'Ajouter une piece jointe sur un achat ou un retour fournisseur', TRUE),
  ('purchase_attachments.delete', 'Supprimer piece jointe achat', 'Purchases', 'Supprimer logiquement une piece jointe achat ou retour fournisseur', TRUE),
  ('purchase_returns.read', 'Consulter retours fournisseur', 'Purchases', 'Voir les retours et echanges fournisseur', TRUE),
  ('purchase_returns.create', 'Creer retour fournisseur', 'Purchases', 'Creer un brouillon de retour fournisseur', TRUE),
  ('purchase_returns.validate', 'Valider retour fournisseur', 'Purchases', 'Valider un retour fournisseur et ses impacts stock', TRUE),
  ('purchase_returns.cancel', 'Annuler retour fournisseur', 'Purchases', 'Annuler un retour fournisseur en brouillon', TRUE),
  ('purchase_returns.refund', 'Regler retour fournisseur', 'Purchases', 'Enregistrer un remboursement ou un complement fournisseur', TRUE),
  ('purchase_returns.exchange', 'Gerer echanges fournisseur', 'Purchases', 'Ajouter des produits recus en echange fournisseur', TRUE),
  ('customer_returns.read', 'Consulter retours clients', 'Sales', 'Voir les retours clients et leurs dossiers', TRUE),
  ('customer_returns.create', 'Creer retour client', 'Sales', 'Creer un brouillon de retour client depuis une vente validee', TRUE),
  ('customer_returns.inspect', 'Inspecter retour client', 'Sales', 'Enregistrer la decision d inspection du retour client', TRUE),
  ('customer_returns.validate', 'Valider retour client', 'Sales', 'Valider un retour client inspecte', TRUE),
  ('customer_returns.cancel', 'Annuler retour client', 'Sales', 'Annuler un retour client brouillon ou en inspection', TRUE),
  ('customer_returns.exchange', 'Gerer echanges retour client', 'Sales', 'Ajouter les produits remis en echange sur un retour client', TRUE),
  ('customer_returns.refund', 'Regler retour client', 'Sales', 'Enregistrer un remboursement ou un complement client', TRUE),
  ('customer_returns.credit', 'Creer avoir client', 'Sales', 'Creer un avoir client depuis un retour', TRUE),
  ('customer_return_attachments.read', 'Consulter pieces jointes retour client', 'Sales', 'Voir les pieces jointes des retours clients', TRUE),
  ('customer_return_attachments.create', 'Ajouter piece jointe retour client', 'Sales', 'Ajouter une piece jointe sur un retour client', TRUE),
  ('customer_return_attachments.delete', 'Supprimer piece jointe retour client', 'Sales', 'Supprimer logiquement une piece jointe de retour client', TRUE),
  ('customer_credits.read', 'Consulter avoirs clients', 'Sales', 'Voir les avoirs clients disponibles', TRUE),
  ('customer_credits.create', 'Creer avoir client', 'Sales', 'Creer un avoir client depuis un retour valide', TRUE),
  ('customer_credits.use', 'Utiliser avoir client', 'Sales', 'Utiliser un avoir client sur une vente ulterieure', TRUE),
  ('supplier_credits.read', 'Consulter avoirs fournisseur', 'Purchases', 'Voir les avoirs fournisseur disponibles', TRUE),
  ('supplier_credits.create', 'Creer avoir fournisseur', 'Purchases', 'Creer un avoir fournisseur depuis un retour', TRUE),
  ('supplier_credits.use', 'Utiliser avoir fournisseur', 'Purchases', 'Utiliser un avoir fournisseur sur un achat ulterieur', TRUE),
  ('lots.read', 'Consulter lots', 'Lots', 'Voir les lots', TRUE),
  ('lots.block', 'Bloquer lot', 'Lots', 'Bloquer ou debloquer un lot', TRUE),
  ('fefo.read', 'Consulter tableau FEFO', 'FEFO', 'Voir les priorites FEFO et la rotation des rayons', TRUE),
  ('fefo.actions.execute', 'Executer action FEFO', 'FEFO', 'Confirmer les actions FEFO non stockees', TRUE),
  ('lots.expired_stock.remove', 'Retirer lot expire du stock', 'Lots', 'Sortir du stock les quantites expirees', TRUE),
  ('stocks.read', 'Consulter stocks', 'Stocks', 'Voir les stocks', TRUE),
  ('stock_movements.read', 'Consulter mouvements stock', 'StockMovements', 'Voir les mouvements de stock', TRUE),
  ('stock_movements.export', 'Exporter mouvements stock', 'StockMovements', 'Exporter les mouvements de stock', TRUE),
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
  ('inventories.count', 'Saisir comptage inventaire', 'Inventories', 'Saisir et autosauvegarder le stock physique', TRUE),
  ('inventories.close', 'Cloturer inventaire', 'Inventories', 'Cloturer un inventaire physique', TRUE),
  ('inventories.validate', 'Valider inventaire', 'Inventories', 'Valider les ecarts inventaire', TRUE),
  ('inventories.print', 'Imprimer inventaire', 'Inventories', 'Imprimer la feuille de comptage inventaire', TRUE),
  ('inventories.fill_empty_zero', 'Completer inventaire a zero', 'Inventories', 'Remplir a zero les lignes non saisies d un inventaire', TRUE),
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
  ('settlements.read', 'Consulter ecarts reglement', 'Settlements', 'Voir les ecarts de reglement des ventes', TRUE),
  ('settlements.justify', 'Justifier ecart reglement', 'Settlements', 'Saisir un motif d ecart de reglement', TRUE),
  ('settlements.adjust', 'Ajuster ecart reglement', 'Settlements', 'Corriger un ecart de reglement apres validation', TRUE),
  ('settlements.export', 'Exporter ecarts reglement', 'Settlements', 'Exporter les ecarts de reglement', TRUE),
  ('cash.discrepancies.read', 'Consulter ecarts caisse', 'Cash', 'Voir les ecarts de reglement et ecarts physiques', TRUE),
  ('cash.discrepancies.manage', 'Gerer ecarts caisse', 'Cash', 'Gerer les ecarts de reglement et corrections', TRUE),
  ('comments.read', 'Consulter commentaires', 'Collaboration', 'Voir les commentaires metier et notes internes', TRUE),
  ('comments.create', 'Creer commentaire', 'Collaboration', 'Ajouter un commentaire metier', TRUE),
  ('comments.update', 'Modifier commentaire', 'Collaboration', 'Modifier un commentaire existant', TRUE),
  ('comments.delete', 'Supprimer commentaire', 'Collaboration', 'Supprimer ou moderer un commentaire', TRUE),
  ('chat.read', 'Consulter messagerie interne', 'Collaboration', 'Voir les discussions internes', TRUE),
  ('chat.send', 'Envoyer message interne', 'Collaboration', 'Envoyer un message interne', TRUE),
  ('chat.manage', 'Gerer messagerie interne', 'Collaboration', 'Creer et organiser les discussions internes', TRUE),
  ('sessions.multiple', 'Ouvrir plusieurs sessions', 'Cash', 'Autoriser plusieurs sessions ouvertes pour un meme utilisateur', TRUE),
  ('workstations.manage', 'Gerer postes de travail', 'Cash', 'Creer et modifier les postes de travail POS et back office', TRUE),
  ('pos_sync.read', 'Consulter synchronisation POS offline', 'Offline', 'Lire le bootstrap et les changements descendants POS offline', TRUE),
  ('pos_sync.execute', 'Executer synchronisation POS offline', 'Offline', 'Enregistrer un poste POS offline et executer le bootstrap', TRUE),
  ('offline_allocations.read', 'Consulter allocations offline', 'Offline', 'Lire les allocations offline affectees a un poste', TRUE),
  ('settings.exchange_rate.read', 'Consulter taux de change', 'Settings', 'Voir le taux USD/CDF du tenant', TRUE),
  ('settings.exchange_rate.update', 'Modifier taux de change', 'Settings', 'Modifier le taux USD/CDF du tenant', TRUE),
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
  ('transfers.read', 'Consulter transferts', 'Transfers', 'Voir les transferts', TRUE),
  ('transfers.create', 'Creer transfert', 'Transfers', 'Creer un transfert brouillon', TRUE),
  ('transfers.update_draft', 'Modifier transfert brouillon', 'Transfers', 'Ajouter ou supprimer des lignes transfert', TRUE),
  ('transfers.validate', 'Valider transfert', 'Transfers', 'Valider un transfert et creer les mouvements stock', TRUE)
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
ON CONFLICT (tenant_id, role_name) DO UPDATE
SET
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
  'product_units.read',
  'product_units.create',
  'dosages.read',
  'dosages.create',
  'active_ingredients.read',
  'active_ingredients.create',
  'atc_codes.read',
  'atc_codes.create',
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
  'purchases.pay',
  'purchase_payments.read',
  'purchase_attachments.read',
  'purchase_attachments.create',
  'purchase_attachments.delete',
  'purchase_returns.read',
  'purchase_returns.create',
  'purchase_returns.validate',
  'purchase_returns.cancel',
  'purchase_returns.refund',
  'purchase_returns.exchange',
  'customer_returns.read',
  'customer_returns.create',
  'customer_returns.inspect',
  'customer_returns.validate',
  'customer_returns.cancel',
  'customer_returns.exchange',
  'customer_returns.refund',
  'customer_returns.credit',
  'customer_return_attachments.read',
  'customer_return_attachments.create',
  'customer_return_attachments.delete',
  'customer_credits.read',
  'customer_credits.create',
  'customer_credits.use',
  'supplier_credits.read',
  'supplier_credits.create',
  'supplier_credits.use',
  'lots.read',
  'lots.block',
  'fefo.read',
  'fefo.actions.execute',
  'lots.expired_stock.remove',
  'stocks.read',
  'stock_movements.read',
  'stock_movements.export',
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
  'inventories.count',
  'inventories.close',
  'inventories.validate',
  'inventories.print',
  'inventories.fill_empty_zero',
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
  'settlements.read',
  'settlements.justify',
  'settlements.adjust',
  'settlements.export',
  'cash.discrepancies.read',
  'cash.discrepancies.manage',
  'comments.read',
  'comments.create',
  'comments.update',
  'comments.delete',
  'chat.read',
  'chat.send',
  'chat.manage',
  'workstations.manage',
  'pos_sync.read',
  'pos_sync.execute',
  'offline_allocations.read',
  'settings.exchange_rate.read',
  'settings.exchange_rate.update',
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
  'transfers.read',
  'transfers.create',
  'transfers.update_draft',
  'transfers.validate'
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
WHERE t.tenant_code = 'DEMO'
ON CONFLICT (tenant_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'DEMO'
),
unit_data(unit_code, unit_label, normalized_label) AS (
  VALUES
    ('UNIT', 'Unite', 'unite'),
    ('TABLET', 'Comprime', 'comprime'),
    ('CAPSULE', 'Gelule', 'gelule'),
    ('LOZENGE', 'Pastille', 'pastille'),
    ('SUPPOSITORY', 'Suppositoire', 'suppositoire'),
    ('OVULE', 'Ovule', 'ovule'),
    ('AMPOULE', 'Ampoule', 'ampoule'),
    ('VIAL', 'Fiole', 'fiole'),
    ('SACHET', 'Sachet', 'sachet'),
    ('DOSE', 'Dose', 'dose'),
    ('DROP', 'Goutte', 'goutte'),
    ('ML', 'Millilitre', 'millilitre'),
    ('L', 'Litre', 'litre'),
    ('G', 'Gramme', 'gramme'),
    ('MG', 'Milligramme', 'milligramme'),
    ('PATCH', 'Patch', 'patch'),
    ('TEST', 'Test', 'test'),
    ('KIT', 'Kit', 'kit'),
    ('BLISTER', 'Plaquette', 'plaquette'),
    ('BOX', 'Boite', 'boite'),
    ('BOTTLE', 'Flacon', 'flacon'),
    ('BOTTLE_LARGE', 'Bouteille', 'bouteille'),
    ('TUBE', 'Tube', 'tube'),
    ('JAR', 'Pot', 'pot'),
    ('PACK', 'Paquet', 'paquet'),
    ('CARTON', 'Carton', 'carton'),
    ('BAG', 'Sac', 'sac'),
    ('ROLL', 'Rouleau', 'rouleau'),
    ('CASE', 'Caisse', 'caisse'),
    ('PALLET', 'Palette', 'palette')
)
INSERT INTO product_units (tenant_id, unit_code, unit_label, normalized_label, is_active)
SELECT t.tenant_id, d.unit_code, d.unit_label, d.normalized_label, TRUE
FROM target_tenant t
CROSS JOIN unit_data d
ON CONFLICT (tenant_id, normalized_label) DO UPDATE
SET unit_code = EXCLUDED.unit_code,
    unit_label = EXCLUDED.unit_label,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'DEMO'
),
dosage_data(dosage_label, normalized_label) AS (
  VALUES
    ('5 mg', '5mg'),
    ('10 mg', '10mg'),
    ('100 mg', '100mg'),
    ('250 mg', '250mg'),
    ('500 mg', '500mg'),
    ('1 g', '1g'),
    ('5 mg/ml', '5mg/ml'),
    ('100 mg/5 ml', '100mg/5ml'),
    ('0,5 %', '0,5%'),
    ('10 UI/ml', '10ui/ml'),
    ('500 mg + 65 mg', '500mg+65mg')
)
INSERT INTO dosages (tenant_id, dosage_label, normalized_label, is_active)
SELECT t.tenant_id, d.dosage_label, d.normalized_label, TRUE
FROM target_tenant t
CROSS JOIN dosage_data d
ON CONFLICT (tenant_id, normalized_label) DO UPDATE
SET dosage_label = EXCLUDED.dosage_label,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'DEMO'
),
ingredient_data(canonical_name, normalized_name) AS (
  VALUES
    ('Paracetamol', 'paracetamol'),
    ('Amoxicilline', 'amoxicilline'),
    ('Ibuprofene', 'ibuprofene'),
    ('Artemether + Lumefantrine', 'artemether+lumefantrine')
)
INSERT INTO active_ingredients (tenant_id, canonical_name, normalized_name, is_active)
SELECT t.tenant_id, d.canonical_name, d.normalized_name, TRUE
FROM target_tenant t
CROSS JOIN ingredient_data d
ON CONFLICT (tenant_id, normalized_name) DO UPDATE
SET canonical_name = EXCLUDED.canonical_name,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'DEMO'
),
atc_data(atc_code, atc_label) AS (
  VALUES
    ('N02BE01', 'Paracetamol'),
    ('J01CA04', 'Amoxicilline'),
    ('M01AE01', 'Ibuprofene'),
    ('P01BF01', 'Artemether + Lumefantrine')
)
INSERT INTO atc_codes (tenant_id, atc_code, atc_label, is_active)
SELECT t.tenant_id, d.atc_code, d.atc_label, TRUE
FROM target_tenant t
CROSS JOIN atc_data d
ON CONFLICT (tenant_id, atc_code) DO UPDATE
SET atc_label = EXCLUDED.atc_label,
    is_active = TRUE,
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
