-- Hotfix inventaires - permissions de comptage assiste
-- Idempotent et additif

BEGIN;

INSERT INTO permissions (permission_code, permission_name, module_name, description, is_system_permission)
VALUES
  ('inventories.print', 'Imprimer inventaire', 'Inventories', 'Imprimer la feuille de comptage inventaire', TRUE),
  ('inventories.fill_empty_zero', 'Completer inventaire a zero', 'Inventories', 'Remplir a zero les lignes non saisies d un inventaire', TRUE)
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = EXCLUDED.is_system_permission;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
JOIN permissions p ON p.permission_code IN ('inventories.print', 'inventories.fill_empty_zero')
WHERE r.role_name = 'ADMIN'
  AND t.tenant_code IN ('DEMO', 'PHARMACIE_DEMO', 'STAGING')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;

SELECT
  t.tenant_code,
  r.role_name,
  BOOL_OR(p.permission_code = 'inventories.print') AS has_inventories_print,
  BOOL_OR(p.permission_code = 'inventories.fill_empty_zero') AS has_inventories_fill_empty_zero
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
LEFT JOIN permissions p ON p.permission_id = rp.permission_id
WHERE r.role_name = 'ADMIN'
  AND t.tenant_code IN ('DEMO', 'PHARMACIE_DEMO', 'STAGING')
GROUP BY t.tenant_code, r.role_name
ORDER BY t.tenant_code;
