-- Correctif immediat - permissions Parametres / Taux de change
-- A executer dans Supabase SQL Editor.
-- Ne modifie pas le schema.

BEGIN;

WITH required_permissions(permission_code, permission_name, module_name, description) AS (
  VALUES
    ('settings.exchange_rate.read', 'Consulter taux de change', 'Settings', 'Voir le taux USD/CDF du tenant'),
    ('settings.exchange_rate.update', 'Modifier taux de change', 'Settings', 'Modifier le taux USD/CDF du tenant')
)
INSERT INTO permissions (
  permission_code,
  permission_name,
  module_name,
  description,
  is_system_permission
)
SELECT
  permission_code,
  permission_name,
  module_name,
  description,
  TRUE
FROM required_permissions
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = TRUE;

WITH target_tenants AS (
  SELECT tenant_id, tenant_code
  FROM tenants
  WHERE tenant_code IN ('STAGING', 'PHARMACIE_DEMO')
     OR tenant_id IN (
       SELECT tenant_id
       FROM users
       WHERE lower(email) IN (lower('admin@staging.local'), lower('admin@pharmacie-demo.local'))
     )
),
target_roles AS (
  SELECT r.role_id, r.tenant_id
  FROM roles r
  JOIN target_tenants t ON t.tenant_id = r.tenant_id
  WHERE r.role_name = 'ADMIN'
),
required_permissions(permission_code) AS (
  VALUES
    ('settings.exchange_rate.read'),
    ('settings.exchange_rate.update')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT tr.role_id, p.permission_id
FROM target_roles tr
JOIN permissions p ON p.permission_code IN (SELECT permission_code FROM required_permissions)
ON CONFLICT (role_id, permission_id) DO NOTHING;

UPDATE users u
SET role_id = r.role_id,
    is_active = TRUE
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
WHERE r.role_name = 'ADMIN'
  AND u.tenant_id = t.tenant_id
  AND (
    (t.tenant_code = 'STAGING' AND lower(u.email) = lower('admin@staging.local'))
    OR
    (t.tenant_code = 'PHARMACIE_DEMO' AND lower(u.email) = lower('admin@pharmacie-demo.local'))
  );

COMMIT;

SELECT
  u.email,
  r.role_name,
  BOOL_OR(p.permission_code = 'settings.exchange_rate.read') AS has_exchange_rate_read,
  BOOL_OR(p.permission_code = 'settings.exchange_rate.update') AS has_exchange_rate_update
FROM users u
JOIN roles r ON r.role_id = u.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
LEFT JOIN permissions p ON p.permission_id = rp.permission_id
WHERE lower(u.email) IN (lower('admin@staging.local'), lower('admin@pharmacie-demo.local'))
GROUP BY u.email, r.role_name
ORDER BY u.email;
