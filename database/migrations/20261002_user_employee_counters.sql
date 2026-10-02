CREATE TABLE IF NOT EXISTS user_employee_counters (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_employee_number_unique
  ON users (tenant_id, employee_number)
  WHERE employee_number IS NOT NULL;

INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, updated_at)
SELECT tenant_id, 'EMPLOYEE_NUMBERS_ENABLED', 'true', CURRENT_TIMESTAMP
FROM tenants
WHERE tenant_code = 'CANA'
ON CONFLICT (tenant_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;

UPDATE users u
SET employee_number = 'EMP-000001'
FROM tenants t
WHERE t.tenant_id = u.tenant_id
  AND t.tenant_code = 'CANA'
  AND lower(u.email) = lower('odnoricia@gmail.com')
  AND u.employee_number IS NULL;

INSERT INTO user_employee_counters (tenant_id, last_number, updated_at)
SELECT
  t.tenant_id,
  GREATEST(
    1,
    COALESCE(MAX(substring(u.employee_number from '^EMP-([0-9]{6})$')::int), 0)
  ),
  CURRENT_TIMESTAMP
FROM tenants t
LEFT JOIN users u
  ON u.tenant_id = t.tenant_id
  AND u.employee_number ~ '^EMP-[0-9]{6}$'
WHERE t.tenant_code = 'CANA'
GROUP BY t.tenant_id
ON CONFLICT (tenant_id) DO UPDATE
SET last_number = GREATEST(user_employee_counters.last_number, EXCLUDED.last_number),
    updated_at = CURRENT_TIMESTAMP;
