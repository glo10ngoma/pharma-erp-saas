-- Correctif cible PHARMACIE_DEMO - role ADMIN tenant-safe
-- Ne modifie que l'utilisateur admin@pharmacie-demo.local
-- Echec explicite si les donnees attendues sont absentes ou ambigues.

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

DO $$
DECLARE
  target_tenant_id UUID;
  target_user_id UUID;
  tenant_count INTEGER;
  user_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO tenant_count
  FROM tenants
  WHERE tenant_code = 'PHARMACIE_DEMO';

  IF tenant_count <> 1 THEN
    RAISE EXCEPTION 'PHARMACIE_DEMO tenant attendu une seule fois, trouve: %', tenant_count;
  END IF;

  SELECT tenant_id
  INTO target_tenant_id
  FROM tenants
  WHERE tenant_code = 'PHARMACIE_DEMO';

  SELECT COUNT(*)
  INTO user_count
  FROM users
  WHERE lower(email) = lower('admin@pharmacie-demo.local')
    AND tenant_id = target_tenant_id;

  IF user_count <> 1 THEN
    RAISE EXCEPTION 'Utilisateur admin@pharmacie-demo.local attendu une seule fois dans PHARMACIE_DEMO, trouve: %', user_count;
  END IF;

  SELECT user_id
  INTO target_user_id
  FROM users
  WHERE lower(email) = lower('admin@pharmacie-demo.local')
    AND tenant_id = target_tenant_id;

  IF EXISTS (
    SELECT 1
    FROM roles
    WHERE tenant_id = target_tenant_id
      AND role_name = 'ADMIN'
    GROUP BY role_name
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Plusieurs roles ADMIN detectes dans PHARMACIE_DEMO';
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
  'Administrateur pharmacie demo',
  TRUE
FROM tenants t
WHERE t.tenant_code = 'PHARMACIE_DEMO'
ON CONFLICT (tenant_id, role_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

WITH source_permissions AS (
  SELECT DISTINCT rp.permission_id
  FROM role_permissions rp
  JOIN roles r ON r.role_id = rp.role_id
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code = 'STAGING'
    AND r.role_name = 'ADMIN'
),
target_role AS (
  SELECT r.role_id
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code = 'PHARMACIE_DEMO'
    AND r.role_name = 'ADMIN'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT tr.role_id, sp.permission_id
FROM target_role tr
CROSS JOIN source_permissions sp
ON CONFLICT (role_id, permission_id) DO NOTHING;

UPDATE users u
SET role_id = r.role_id,
    is_active = TRUE
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
WHERE u.tenant_id = t.tenant_id
  AND t.tenant_code = 'PHARMACIE_DEMO'
  AND r.role_name = 'ADMIN'
  AND lower(u.email) = lower('admin@pharmacie-demo.local');

COMMIT;

SELECT
  u.email,
  tu.tenant_code AS user_tenant_code,
  ru.role_name,
  tr.tenant_code AS role_tenant_code,
  s.site_code,
  u.is_active AS user_active,
  COUNT(DISTINCT rp.permission_id)::int AS permissions_count,
  BOOL_OR(p.permission_code = 'reports.dashboard') AS has_reports_dashboard,
  BOOL_OR(p.permission_code = 'settings.exchange_rate.read') AS has_exchange_rate_read,
  BOOL_OR(p.permission_code = 'workstations.manage') AS has_workstations_manage,
  BOOL_OR(p.permission_code = 'sessions.multiple') AS has_sessions_multiple
FROM users u
JOIN tenants tu ON tu.tenant_id = u.tenant_id
JOIN roles ru ON ru.role_id = u.role_id
JOIN tenants tr ON tr.tenant_id = ru.tenant_id
LEFT JOIN sites s ON s.site_id = u.site_id
LEFT JOIN role_permissions rp ON rp.role_id = ru.role_id
LEFT JOIN permissions p ON p.permission_id = rp.permission_id
WHERE lower(u.email) = lower('admin@pharmacie-demo.local')
GROUP BY u.email, tu.tenant_code, ru.role_name, tr.tenant_code, s.site_code, u.is_active;
