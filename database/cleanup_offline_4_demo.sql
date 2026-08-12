-- Cleanup cible pour la recette Offline 4
-- Supprime uniquement les donnees liees au tenant OFFLINE_STAGING
-- et/ou aux identifiants OFF-STG-*.

BEGIN;

DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id
  INTO v_tenant_id
  FROM tenants
  WHERE tenant_code = 'OFFLINE_STAGING'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM pos_workstation_status
  WHERE tenant_id = v_tenant_id;

  DELETE FROM pos_sync_conflicts
  WHERE tenant_id = v_tenant_id;

  DELETE FROM pos_sync_operations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM offline_stock_allocations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_movements
  WHERE tenant_id = v_tenant_id
    AND (
      notes ILIKE 'OFF-STG%'
      OR reference_type IN ('SALE', 'TRANSFER')
    );

  DELETE FROM cash_movements
  WHERE tenant_id = v_tenant_id;

  DELETE FROM payments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sale_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sales
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_transfer_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_transfers
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stocks
  WHERE tenant_id = v_tenant_id;

  DELETE FROM lots
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchases
  WHERE tenant_id = v_tenant_id;

  DELETE FROM audit_logs
  WHERE tenant_id = v_tenant_id
    AND (
      table_name IN ('pos_workstations', 'offline_stock_allocations', 'pos_sync_conflicts')
      OR COALESCE(new_value::text, '') ILIKE '%OFF-STG%'
    );

  DELETE FROM cash_sessions
  WHERE tenant_id = v_tenant_id;

  DELETE FROM pos_workstations
  WHERE tenant_id = v_tenant_id
     OR workstation_code LIKE 'POS-STG-%'
     OR workstation_name LIKE 'POS-STG-%'
     OR device_uuid LIKE 'POS-STG-%';
END $$;

COMMIT;
