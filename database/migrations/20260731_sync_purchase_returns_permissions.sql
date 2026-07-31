-- Migration: sync purchase return and attachment permissions for PHARMACIE_DEMO admin.
-- Additive only, idempotent, and tenant-scoped for role assignment.

BEGIN;

WITH expected_permissions(permission_code, permission_name, module_name, description, is_system_permission) AS (
  VALUES
    ('purchase_attachments.read', 'Consulter pieces jointes achat', 'Purchases', 'Voir les pieces jointes des achats et retours fournisseur', TRUE),
    ('purchase_attachments.create', 'Ajouter piece jointe achat', 'Purchases', 'Ajouter une piece jointe sur un achat ou un retour fournisseur', TRUE),
    ('purchase_attachments.delete', 'Supprimer piece jointe achat', 'Purchases', 'Supprimer logiquement une piece jointe achat ou retour fournisseur', TRUE),
    ('purchase_returns.read', 'Consulter retours fournisseur', 'Purchases', 'Voir les retours et echanges fournisseur', TRUE),
    ('purchase_returns.create', 'Creer retour fournisseur', 'Purchases', 'Creer un brouillon de retour fournisseur', TRUE),
    ('purchase_returns.validate', 'Valider retour fournisseur', 'Purchases', 'Valider un retour fournisseur et ses impacts stock', TRUE),
    ('purchase_returns.cancel', 'Annuler retour fournisseur', 'Purchases', 'Annuler un retour fournisseur en brouillon', TRUE),
    ('purchase_returns.refund', 'Regler retour fournisseur', 'Purchases', 'Enregistrer un remboursement ou un complement fournisseur', TRUE),
    ('purchase_returns.exchange', 'Gerer echanges fournisseur', 'Purchases', 'Ajouter des produits recus en echange fournisseur', TRUE),
    ('supplier_credits.read', 'Consulter avoirs fournisseur', 'Purchases', 'Voir les avoirs fournisseur disponibles', TRUE),
    ('supplier_credits.create', 'Creer avoir fournisseur', 'Purchases', 'Creer un avoir fournisseur depuis un retour', TRUE),
    ('supplier_credits.use', 'Utiliser avoir fournisseur', 'Purchases', 'Utiliser un avoir fournisseur sur un achat ulterieur', TRUE)
)
INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
SELECT
  ep.permission_code,
  ep.permission_name,
  ep.module_name,
  ep.description,
  ep.is_system_permission
FROM expected_permissions ep
ON CONFLICT (permission_code) DO NOTHING;

WITH target_role AS (
  SELECT r.role_id
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code = 'PHARMACIE_DEMO'
    AND r.role_name = 'ADMIN'
  LIMIT 1
),
expected_permissions(permission_code) AS (
  VALUES
    ('purchase_attachments.read'),
    ('purchase_attachments.create'),
    ('purchase_attachments.delete'),
    ('purchase_returns.read'),
    ('purchase_returns.create'),
    ('purchase_returns.validate'),
    ('purchase_returns.cancel'),
    ('purchase_returns.refund'),
    ('purchase_returns.exchange'),
    ('supplier_credits.read'),
    ('supplier_credits.create'),
    ('supplier_credits.use')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT tr.role_id, p.permission_id
FROM target_role tr
JOIN expected_permissions ep ON TRUE
JOIN permissions p ON p.permission_code = ep.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;

WITH expected_permissions(permission_code) AS (
  VALUES
    ('purchase_attachments.read'),
    ('purchase_attachments.create'),
    ('purchase_attachments.delete'),
    ('purchase_returns.read'),
    ('purchase_returns.create'),
    ('purchase_returns.validate'),
    ('purchase_returns.cancel'),
    ('purchase_returns.refund'),
    ('purchase_returns.exchange'),
    ('supplier_credits.read'),
    ('supplier_credits.create'),
    ('supplier_credits.use')
)
SELECT
  ep.permission_code,
  EXISTS (
    SELECT 1
    FROM permissions p
    WHERE p.permission_code = ep.permission_code
  ) AS permission_exists,
  EXISTS (
    SELECT 1
    FROM roles r
    JOIN tenants t ON t.tenant_id = r.tenant_id
    JOIN role_permissions rp ON rp.role_id = r.role_id
    JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE t.tenant_code = 'PHARMACIE_DEMO'
      AND r.role_name = 'ADMIN'
      AND p.permission_code = ep.permission_code
  ) AS attached_to_admin_pharmacie_demo
FROM expected_permissions ep
ORDER BY ep.permission_code;
