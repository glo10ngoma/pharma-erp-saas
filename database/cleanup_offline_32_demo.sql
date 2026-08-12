-- Cleanup cible pour la recette Offline 3.2
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

  DELETE FROM journal_entry_lines jel
  USING journal_entries je
  WHERE jel.entry_id = je.entry_id
    AND je.tenant_id = v_tenant_id;

  DELETE FROM journal_entries
  WHERE tenant_id = v_tenant_id;

  DELETE FROM accounting_journals
  WHERE tenant_id = v_tenant_id;

  DELETE FROM cash_movements
  WHERE tenant_id = v_tenant_id;

  DELETE FROM cash_expenses
  WHERE tenant_id = v_tenant_id;

  DELETE FROM cash_reconciliations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM receivable_payments rp
  USING accounts_receivable ar
  WHERE rp.receivable_id = ar.receivable_id
    AND ar.tenant_id = v_tenant_id;

  DELETE FROM accounts_receivable
  WHERE tenant_id = v_tenant_id;

  DELETE FROM payments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_payments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_return_settlements
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_return_replacement_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_return_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_returns
  WHERE tenant_id = v_tenant_id;

  DELETE FROM customer_return_settlements
  WHERE tenant_id = v_tenant_id;

  DELETE FROM customer_return_replacement_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM customer_return_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM customer_returns
  WHERE tenant_id = v_tenant_id;

  DELETE FROM customer_credits
  WHERE tenant_id = v_tenant_id;

  DELETE FROM supplier_credits
  WHERE tenant_id = v_tenant_id;

  DELETE FROM customer_account_ledger
  WHERE tenant_id = v_tenant_id;

  DELETE FROM supplier_account_ledger
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sale_fulfillment_items sfi
  USING sale_fulfillments sf
  WHERE sfi.fulfillment_id = sf.fulfillment_id
    AND sf.tenant_id = v_tenant_id;

  DELETE FROM sale_fulfillments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sale_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sales
  WHERE tenant_id = v_tenant_id;

  DELETE FROM inventory_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM inventory_sessions
  WHERE tenant_id = v_tenant_id;

  DELETE FROM attachments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_attachments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM entity_comments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM chat_messages
  WHERE tenant_id = v_tenant_id;

  DELETE FROM chat_threads
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_transfer_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_transfers
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_movements
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stocks
  WHERE tenant_id = v_tenant_id;

  DELETE FROM lots
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchases
  WHERE tenant_id = v_tenant_id;

  DELETE FROM offline_stock_allocations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM pos_sync_operations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM audit_logs
  WHERE tenant_id = v_tenant_id;

  DELETE FROM cash_sessions
  WHERE tenant_id = v_tenant_id;

  DELETE FROM pos_workstations
  WHERE tenant_id = v_tenant_id
     OR workstation_code LIKE 'POS-STG-%'
     OR workstation_name LIKE 'POS-STG-%'
     OR device_uuid LIKE 'POS-STG-%';

  DELETE FROM cash_registers
  WHERE tenant_id = v_tenant_id
     OR register_code LIKE 'OFF-STG-%'
     OR register_name LIKE 'OFF-STG-%';

  DELETE FROM articles
  WHERE tenant_id = v_tenant_id
     OR article_code LIKE 'OFF-STG-ARTICLE-%'
     OR commercial_name LIKE 'OFF-STG-%';

  DELETE FROM suppliers
  WHERE tenant_id = v_tenant_id
     OR supplier_code LIKE 'OFF-STG-%'
     OR supplier_name LIKE 'OFF-STG-%';

  DELETE FROM sub_categories
  WHERE tenant_id = v_tenant_id
     OR sub_category_code LIKE 'OFF-STG-%'
     OR sub_category_name LIKE 'OFF-STG-%';

  DELETE FROM categories
  WHERE tenant_id = v_tenant_id
     OR category_code LIKE 'OFF-STG-%'
     OR category_name LIKE 'OFF-STG-%';

  DELETE FROM galenic_forms
  WHERE tenant_id = v_tenant_id
     OR form_code LIKE 'OFF-STG-%'
     OR form_name LIKE 'OFF-STG-%';

  DELETE FROM administration_routes
  WHERE tenant_id = v_tenant_id
     OR route_code LIKE 'OFF-STG-%'
     OR route_name LIKE 'OFF-STG-%';

  DELETE FROM product_types
  WHERE tenant_id = v_tenant_id
     OR type_code LIKE 'OFF-STG-%'
     OR type_name LIKE 'OFF-STG-%';

  DELETE FROM article_price_history
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_alerts
  WHERE tenant_id = v_tenant_id;

  DELETE FROM expiry_alerts
  WHERE tenant_id = v_tenant_id;

  DELETE FROM notifications
  WHERE tenant_id = v_tenant_id;

  DELETE FROM chart_of_accounts
  WHERE tenant_id = v_tenant_id;
END $$;

COMMIT;
