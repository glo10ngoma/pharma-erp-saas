-- Politique sessions.multiple - hotfix final Sprint 13
-- Retire sessions.multiple des roles ADMIN standards demo/staging/pharmacie_demo.
-- La permission reste definie dans permissions et peut etre attribuee explicitement
-- a un role de supervision ou a un utilisateur specifique.

BEGIN;

WITH target_roles AS (
  SELECT r.role_id, t.tenant_code, r.role_name
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE r.role_name = 'ADMIN'
    AND t.tenant_code IN ('DEMO', 'STAGING', 'PHARMACIE_DEMO')
),
target_permission AS (
  SELECT permission_id
  FROM permissions
  WHERE permission_code = 'sessions.multiple'
)
DELETE FROM role_permissions rp
USING target_roles tr, target_permission tp
WHERE rp.role_id = tr.role_id
  AND rp.permission_id = tp.permission_id;

COMMIT;

SELECT
  t.tenant_code,
  r.role_name,
  COUNT(*) FILTER (WHERE p.permission_code = 'sessions.multiple')::int AS sessions_multiple_assignments
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
LEFT JOIN permissions p ON p.permission_id = rp.permission_id
WHERE r.role_name = 'ADMIN'
  AND t.tenant_code IN ('DEMO', 'STAGING', 'PHARMACIE_DEMO')
GROUP BY t.tenant_code, r.role_name
ORDER BY t.tenant_code;
