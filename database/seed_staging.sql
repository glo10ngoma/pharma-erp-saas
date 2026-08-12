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
  ('purchases.update_draft', 'Modifier achat brouillon', 'Purchases', 'Modifier un achat brouillon', TRUE),
  ('purchases.validate', 'Valider achat', 'Purchases', 'Valider un achat', TRUE),
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
  ('inventories.count', 'Saisir comptage inventaire', 'Inventories', 'Saisir et autosauvegarder le stock physique', TRUE),
  ('inventories.close', 'Cloturer inventaire', 'Inventories', 'Cloturer un inventaire', TRUE),
  ('inventories.validate', 'Valider inventaire', 'Inventories', 'Valider un inventaire', TRUE),
  ('inventories.print', 'Imprimer inventaire', 'Inventories', 'Imprimer la feuille de comptage inventaire', TRUE),
  ('inventories.fill_empty_zero', 'Completer inventaire a zero', 'Inventories', 'Remplir a zero les lignes non saisies d un inventaire', TRUE),
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
  ('pos_offline.admin.read', 'Consulter supervision offline', 'Offline', 'Voir le dashboard de supervision des postes offline', TRUE),
  ('pos_offline.workstations.read', 'Consulter postes offline', 'Offline', 'Voir les postes POS offline et leur etat', TRUE),
  ('offline_allocations.manage', 'Gerer allocations offline', 'Offline', 'Creer, modifier, suspendre et liberer les allocations offline', TRUE),
  ('offline_allocations.transfer', 'Transferer allocations offline', 'Offline', 'Transferer un quota offline entre postes d un meme site', TRUE),
  ('offline_allocations.rebalance', 'Reequilibrer allocations offline', 'Offline', 'Repartir automatiquement les quotas offline entre postes', TRUE),
  ('pos_sync.conflicts.read', 'Consulter conflits offline', 'Offline', 'Voir les conflits de synchronisation offline', TRUE),
  ('pos_sync.conflicts.resolve', 'Resoudre conflits offline', 'Offline', 'Resoudre administrativement les conflits de synchronisation offline', TRUE),
  ('pos_sync.logs.read', 'Consulter journal offline', 'Offline', 'Voir le journal de supervision POS offline', TRUE),
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
  'product_units.read','product_units.create','dosages.read','dosages.create',
  'active_ingredients.read','active_ingredients.create','atc_codes.read','atc_codes.create',
  'suppliers.read','suppliers.create','suppliers.update','suppliers.delete',
  'customers.read','customers.create','customers.update','customers.delete',
  'disposals.read',
  'purchases.read','purchases.create','purchases.update_draft','purchases.validate','purchases.pay','purchase_payments.read',
  'purchase_attachments.read','purchase_attachments.create','purchase_attachments.delete',
  'purchase_returns.read','purchase_returns.create','purchase_returns.validate','purchase_returns.cancel','purchase_returns.refund','purchase_returns.exchange',
  'customer_returns.read','customer_returns.create','customer_returns.inspect','customer_returns.validate','customer_returns.cancel',
  'customer_returns.exchange','customer_returns.refund','customer_returns.credit',
  'customer_return_attachments.read','customer_return_attachments.create','customer_return_attachments.delete',
  'customer_credits.read','customer_credits.create','customer_credits.use',
  'supplier_credits.read','supplier_credits.create','supplier_credits.use',
  'lots.read','lots.block','fefo.read','fefo.actions.execute','lots.expired_stock.remove','stocks.read','stock_movements.read','stock_movements.export',
  'sales.read','sales.create','sales.update_draft','sales.validate','sales.cancel_draft',
  'payments.read','payments.create',
  'cash_sessions.open','cash_sessions.close','cash_sessions.validate','cash_movements.create','cash_expenses.create','cash_registers.read',
  'organizations.read','organizations.create','organizations.update','organizations.disable',
  'insurance_plans.read','insurance_plans.create','insurance_plans.update',
  'memberships.read','memberships.create','memberships.update',
  'notifications.read','prescriptions.read',
  'receivables.read','receivables.pay',
  'inventories.read','inventories.create','inventories.start','inventories.count','inventories.close','inventories.validate','inventories.print','inventories.fill_empty_zero',
  'stock_adjustments.read',
  'accounting.read','accounting.post','accounting.manage_accounts','accounting.trial_balance','accounting.general_ledger',
  'reports.dashboard','reports.sales','reports.stock','reports.cash','reports.receivables','reports.expiry','reports.margins','reports.top_products',
  'settlements.read','settlements.justify','settlements.adjust','settlements.export','cash.discrepancies.read','cash.discrepancies.manage',
  'comments.read','comments.create','comments.update','comments.delete',
  'chat.read','chat.send','chat.manage',
  'workstations.manage',
  'pos_sync.read','pos_sync.execute','offline_allocations.read',
  'pos_offline.admin.read','pos_offline.workstations.read',
  'offline_allocations.manage','offline_allocations.transfer','offline_allocations.rebalance',
  'pos_sync.conflicts.read','pos_sync.conflicts.resolve','pos_sync.logs.read',
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

WITH target_tenant AS (
  SELECT tenant_id FROM tenants WHERE tenant_code = 'STAGING'
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
