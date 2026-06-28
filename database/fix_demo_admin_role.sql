-- Correctif role ADMIN DEMO - idempotent
--
-- Cause corrigee :
-- roles.role_name etait unique globalement, ce qui forcait les tenants DEMO,
-- STAGING et PHARMACIE_DEMO a partager le meme role ADMIN.
--
-- Effet :
-- - remplace l'unicite globale role_name par tenant_id + role_name ;
-- - cree/met a jour le role ADMIN du tenant DEMO ;
-- - copie les permissions du role ADMIN STAGING vers ADMIN DEMO ;
-- - rattache admin@demo.local au role ADMIN du tenant DEMO.

BEGIN;

ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_role_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roles_tenant_id_role_name_key'
      AND conrelid = 'roles'::regclass
  ) THEN
    ALTER TABLE roles
      ADD CONSTRAINT roles_tenant_id_role_name_key UNIQUE (tenant_id, role_name);
  END IF;
END $$;

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
SET description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

WITH staging_admin_permissions AS (
  SELECT rp.permission_id
  FROM role_permissions rp
  JOIN roles r ON r.role_id = rp.role_id
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code = 'STAGING'
    AND r.role_name = 'ADMIN'
),
source_permissions AS (
  SELECT permission_id FROM staging_admin_permissions
  UNION
  SELECT p.permission_id
  FROM permissions p
  WHERE NOT EXISTS (SELECT 1 FROM staging_admin_permissions)
),
demo_admin AS (
  SELECT r.role_id
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code = 'DEMO'
    AND r.role_name = 'ADMIN'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT da.role_id, sp.permission_id
FROM demo_admin da
CROSS JOIN source_permissions sp
ON CONFLICT (role_id, permission_id) DO NOTHING;

UPDATE users u
SET role_id = r.role_id
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
WHERE u.tenant_id = t.tenant_id
  AND t.tenant_code = 'DEMO'
  AND r.role_name = 'ADMIN'
  AND lower(u.email) = lower('admin@demo.local');

COMMIT;

SELECT
  u.email,
  t.tenant_code,
  s.site_code,
  r.role_name,
  u.is_active AS user_active,
  r.is_active AS role_active,
  COUNT(DISTINCT rp.permission_id)::int AS permissions_count,
  (u.tenant_id = r.tenant_id) AS role_same_tenant
FROM users u
JOIN tenants t ON t.tenant_id = u.tenant_id
LEFT JOIN sites s ON s.site_id = u.site_id AND s.tenant_id = u.tenant_id
LEFT JOIN roles r ON r.role_id = u.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
WHERE lower(u.email) = lower('admin@demo.local')
GROUP BY u.email, t.tenant_code, s.site_code, r.role_name, u.is_active, r.is_active, u.tenant_id, r.tenant_id;
