-- Correctif immediat STAGING - permissions ADMIN V1
-- A executer dans Supabase SQL Editor sur la base staging.
-- Ne modifie pas le schema.

BEGIN;

WITH v1_permissions(permission_code) AS (
  VALUES
    ('articles.read'), ('articles.create'), ('articles.update'), ('articles.delete'),
    ('attachments.read'), ('audit.read'),
    ('categories.read'), ('categories.create'), ('categories.update'), ('categories.delete'),
    ('sub_categories.read'), ('sub_categories.create'), ('sub_categories.update'), ('sub_categories.delete'),
    ('galenic_forms.read'), ('galenic_forms.create'), ('galenic_forms.update'), ('galenic_forms.delete'),
    ('administration_routes.read'), ('administration_routes.create'), ('administration_routes.update'), ('administration_routes.delete'),
    ('product_types.read'), ('product_types.create'), ('product_types.update'), ('product_types.delete'),
    ('suppliers.read'), ('suppliers.create'), ('suppliers.update'), ('suppliers.delete'),
    ('customers.read'), ('customers.create'), ('customers.update'), ('customers.delete'),
    ('disposals.read'),
    ('purchases.read'), ('purchases.create'), ('purchases.update_draft'), ('purchases.validate'),
    ('lots.read'), ('lots.block'), ('stocks.read'), ('stock_movements.read'),
    ('sales.read'), ('sales.create'), ('sales.update_draft'), ('sales.validate'), ('sales.cancel_draft'),
    ('payments.read'), ('payments.create'),
    ('cash_sessions.open'), ('cash_sessions.close'), ('cash_sessions.validate'),
    ('cash_movements.create'), ('cash_expenses.create'), ('cash_registers.read'),
    ('organizations.read'), ('organizations.create'), ('organizations.update'), ('organizations.disable'),
    ('insurance_plans.read'), ('insurance_plans.create'), ('insurance_plans.update'),
    ('memberships.read'), ('memberships.create'), ('memberships.update'),
    ('notifications.read'), ('prescriptions.read'),
    ('receivables.read'), ('receivables.pay'),
    ('inventories.read'), ('inventories.create'), ('inventories.start'), ('inventories.close'), ('inventories.validate'),
    ('stock_adjustments.read'),
    ('accounting.read'), ('accounting.post'), ('accounting.manage_accounts'),
    ('accounting.trial_balance'), ('accounting.general_ledger'),
    ('reports.dashboard'), ('reports.sales'), ('reports.stock'), ('reports.cash'),
    ('reports.receivables'), ('reports.expiry'), ('reports.margins'), ('reports.top_products'),
    ('settings.exchange_rate.read'), ('settings.exchange_rate.update'),
    ('tenants.read'),
    ('transfers.read'), ('transfers.create'), ('transfers.update_draft'), ('transfers.validate'),
    ('users.read'), ('users.create'), ('users.update'), ('users.delete'),
    ('roles.read'), ('roles.create'), ('roles.update'), ('roles.delete'), ('roles.assign_permissions'),
    ('permissions.read'), ('permissions.create'), ('permissions.update'), ('permissions.delete'),
    ('sites.read'), ('sites.create'), ('sites.update'), ('sites.delete')
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
  permission_code,
  split_part(permission_code, '.', 1),
  'Permission V1 staging',
  TRUE
FROM v1_permissions
ON CONFLICT (permission_code) DO UPDATE
SET permission_name = EXCLUDED.permission_name,
    module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    is_system_permission = TRUE;

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
    is_active = TRUE;

WITH staging_admin_role AS (
  SELECT r.role_id
  FROM roles r
  JOIN tenants t ON t.tenant_id = r.tenant_id
  WHERE t.tenant_code = 'STAGING'
    AND r.role_name = 'ADMIN'
),
v1_permissions(permission_code) AS (
  VALUES
    ('articles.read'), ('articles.create'), ('articles.update'), ('articles.delete'),
    ('attachments.read'), ('audit.read'),
    ('categories.read'), ('categories.create'), ('categories.update'), ('categories.delete'),
    ('sub_categories.read'), ('sub_categories.create'), ('sub_categories.update'), ('sub_categories.delete'),
    ('galenic_forms.read'), ('galenic_forms.create'), ('galenic_forms.update'), ('galenic_forms.delete'),
    ('administration_routes.read'), ('administration_routes.create'), ('administration_routes.update'), ('administration_routes.delete'),
    ('product_types.read'), ('product_types.create'), ('product_types.update'), ('product_types.delete'),
    ('suppliers.read'), ('suppliers.create'), ('suppliers.update'), ('suppliers.delete'),
    ('customers.read'), ('customers.create'), ('customers.update'), ('customers.delete'),
    ('disposals.read'),
    ('purchases.read'), ('purchases.create'), ('purchases.update_draft'), ('purchases.validate'),
    ('lots.read'), ('lots.block'), ('stocks.read'), ('stock_movements.read'),
    ('sales.read'), ('sales.create'), ('sales.update_draft'), ('sales.validate'), ('sales.cancel_draft'),
    ('payments.read'), ('payments.create'),
    ('cash_sessions.open'), ('cash_sessions.close'), ('cash_sessions.validate'),
    ('cash_movements.create'), ('cash_expenses.create'), ('cash_registers.read'),
    ('organizations.read'), ('organizations.create'), ('organizations.update'), ('organizations.disable'),
    ('insurance_plans.read'), ('insurance_plans.create'), ('insurance_plans.update'),
    ('memberships.read'), ('memberships.create'), ('memberships.update'),
    ('notifications.read'), ('prescriptions.read'),
    ('receivables.read'), ('receivables.pay'),
    ('inventories.read'), ('inventories.create'), ('inventories.start'), ('inventories.close'), ('inventories.validate'),
    ('stock_adjustments.read'),
    ('accounting.read'), ('accounting.post'), ('accounting.manage_accounts'),
    ('accounting.trial_balance'), ('accounting.general_ledger'),
    ('reports.dashboard'), ('reports.sales'), ('reports.stock'), ('reports.cash'),
    ('reports.receivables'), ('reports.expiry'), ('reports.margins'), ('reports.top_products'),
    ('settings.exchange_rate.read'), ('settings.exchange_rate.update'),
    ('tenants.read'),
    ('transfers.read'), ('transfers.create'), ('transfers.update_draft'), ('transfers.validate'),
    ('users.read'), ('users.create'), ('users.update'), ('users.delete'),
    ('roles.read'), ('roles.create'), ('roles.update'), ('roles.delete'), ('roles.assign_permissions'),
    ('permissions.read'), ('permissions.create'), ('permissions.update'), ('permissions.delete'),
    ('sites.read'), ('sites.create'), ('sites.update'), ('sites.delete')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM staging_admin_role r
JOIN permissions p ON p.permission_code IN (SELECT permission_code FROM v1_permissions)
ON CONFLICT (role_id, permission_id) DO NOTHING;

UPDATE users u
SET role_id = r.role_id,
    is_active = TRUE
FROM roles r
JOIN tenants t ON t.tenant_id = r.tenant_id
WHERE t.tenant_code = 'STAGING'
  AND r.role_name = 'ADMIN'
  AND u.tenant_id = t.tenant_id
  AND lower(u.email) = lower('admin@staging.local');

COMMIT;

SELECT
  t.tenant_code,
  r.role_name,
  u.email AS admin_email,
  COUNT(DISTINCT p.permission_code) AS assigned_permissions,
  BOOL_OR(p.permission_code = 'reports.dashboard') AS has_reports_dashboard,
  BOOL_OR(p.permission_code = 'reports.top_products') AS has_reports_top_products,
  BOOL_OR(p.permission_code = 'settings.exchange_rate.read') AS has_exchange_rate_read,
  BOOL_OR(p.permission_code = 'settings.exchange_rate.update') AS has_exchange_rate_update
FROM tenants t
JOIN roles r ON r.tenant_id = t.tenant_id AND r.role_name = 'ADMIN'
LEFT JOIN users u ON u.tenant_id = t.tenant_id AND lower(u.email) = lower('admin@staging.local')
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
LEFT JOIN permissions p ON p.permission_id = rp.permission_id
WHERE t.tenant_code = 'STAGING'
GROUP BY t.tenant_code, r.role_name, u.email;
