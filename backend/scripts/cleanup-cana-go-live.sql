DO $$
DECLARE
  v_tenant_id CONSTANT uuid := '20d87fa6-3195-4388-8f39-0cc317ad132a';
  v_site_id CONSTANT uuid := 'bd30bc22-a473-409e-b136-0f6b5ba2d068';
  v_expected_purchase_number CONSTANT text := 'PUR-1789554777978';
  v_expected_article_code CONSTANT text := 'DMC-SER-00002';
  v_expected_lot_number CONSTANT text := 'DMCSER00-20260916-001';
  v_count integer;
  v_before_other_tenants integer;
  v_after_other_tenants integer;
BEGIN
  SELECT
    COALESCE(SUM(row_count), 0)::int
  INTO v_before_other_tenants
  FROM (
    SELECT COUNT(*) AS row_count FROM purchases WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM sales WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM lots WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM stocks WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM stock_movements WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM payments WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM cash_sessions WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM cash_movements WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM journal_entries WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM journal_entry_lines WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM offline_stock_allocations WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM pos_sync_operations WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM pos_sync_conflicts WHERE tenant_id <> v_tenant_id
  ) snapshot;

  IF (SELECT COUNT(*) FROM tenants WHERE tenant_id = v_tenant_id AND tenant_code = 'CANA') <> 1 THEN
    RAISE EXCEPTION 'CANA tenant assertion failed';
  END IF;

  IF (SELECT COUNT(*) FROM sites WHERE tenant_id = v_tenant_id AND site_id = v_site_id AND site_name = 'CANA MATETE') <> 1 THEN
    RAISE EXCEPTION 'CANA MATETE site assertion failed';
  END IF;

  IF (SELECT COUNT(*) FROM users WHERE tenant_id = v_tenant_id AND email = 'odnoricia@gmail.com' AND is_active = true) <> 1 THEN
    RAISE EXCEPTION 'Oricia active user assertion failed';
  END IF;

  IF (SELECT COUNT(*) FROM articles WHERE tenant_id = v_tenant_id) <> 9393 THEN
    RAISE EXCEPTION 'CANA catalogue count assertion failed';
  END IF;

  IF (SELECT COUNT(*) FROM purchases WHERE tenant_id = v_tenant_id) <> 1
     OR (SELECT COUNT(*) FROM purchases WHERE tenant_id = v_tenant_id AND purchase_number = v_expected_purchase_number) <> 1 THEN
    RAISE EXCEPTION 'Unexpected CANA purchases found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM purchase_items pi
    JOIN articles a ON a.article_id = pi.article_id
    WHERE pi.tenant_id = v_tenant_id
      AND a.article_code <> v_expected_article_code
  ) THEN
    RAISE EXCEPTION 'Unexpected CANA purchase item article found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sale_items si
    JOIN articles a ON a.article_id = si.article_id
    WHERE si.tenant_id = v_tenant_id
      AND a.article_code <> v_expected_article_code
  ) THEN
    RAISE EXCEPTION 'Unexpected CANA sale item article found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lots
    WHERE tenant_id = v_tenant_id
      AND lot_number <> v_expected_lot_number
  ) THEN
    RAISE EXCEPTION 'Unexpected CANA lot found';
  END IF;

  IF (SELECT COUNT(*) FROM accounts_receivable WHERE tenant_id = v_tenant_id) <> 0
     OR (SELECT COUNT(*) FROM receivable_payments WHERE tenant_id = v_tenant_id) <> 0
     OR (SELECT COUNT(*) FROM inventory_sessions WHERE tenant_id = v_tenant_id) <> 0
     OR (SELECT COUNT(*) FROM inventory_items WHERE tenant_id = v_tenant_id) <> 0
     OR (SELECT COUNT(*) FROM price_checks WHERE tenant_id = v_tenant_id) <> 0
     OR (SELECT COUNT(*) FROM price_check_items WHERE tenant_id = v_tenant_id) <> 0 THEN
    RAISE EXCEPTION 'Unexpected CANA transactional data found outside validated cleanup scope';
  END IF;

  DELETE FROM journal_entry_lines
  WHERE tenant_id = v_tenant_id;

  DELETE FROM journal_entries
  WHERE tenant_id = v_tenant_id;

  DELETE FROM pos_sync_conflicts
  WHERE tenant_id = v_tenant_id;

  DELETE FROM pos_sync_operations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM offline_stock_allocations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM cash_movements
  WHERE tenant_id = v_tenant_id;

  DELETE FROM payments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sale_fulfillment_items
  WHERE sale_item_id IN (
    SELECT sale_item_id FROM sale_items WHERE tenant_id = v_tenant_id
  );

  DELETE FROM sale_fulfillments
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sale_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM sales
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchase_attachments
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

  DELETE FROM purchase_items
  WHERE tenant_id = v_tenant_id;

  DELETE FROM purchases
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stock_movements
  WHERE tenant_id = v_tenant_id;

  DELETE FROM stocks
  WHERE tenant_id = v_tenant_id;

  DELETE FROM lots
  WHERE tenant_id = v_tenant_id;

  UPDATE audit_logs
  SET cash_session_id = NULL
  WHERE tenant_id = v_tenant_id
    AND cash_session_id IS NOT NULL;

  DELETE FROM cash_denominations
  WHERE tenant_id = v_tenant_id;

  DELETE FROM cash_sessions
  WHERE tenant_id = v_tenant_id;

  INSERT INTO purchase_number_counters (tenant_id, last_number, updated_at)
  VALUES (v_tenant_id, 0, CURRENT_TIMESTAMP)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    last_number = 0,
    updated_at = CURRENT_TIMESTAMP;

  IF (SELECT COUNT(*) FROM articles WHERE tenant_id = v_tenant_id) <> 9393 THEN
    RAISE EXCEPTION 'Post-cleanup catalogue count changed';
  END IF;

  IF (SELECT COUNT(*) FROM sites WHERE tenant_id = v_tenant_id AND site_id = v_site_id) <> 1 THEN
    RAISE EXCEPTION 'Post-cleanup CANA site missing';
  END IF;

  IF (SELECT COUNT(*) FROM users WHERE tenant_id = v_tenant_id AND email = 'odnoricia@gmail.com' AND is_active = true) <> 1 THEN
    RAISE EXCEPTION 'Post-cleanup Oricia user missing/inactive';
  END IF;

  SELECT
    COALESCE(SUM(row_count), 0)::int
  INTO v_count
  FROM (
    SELECT COUNT(*) AS row_count FROM purchases WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM purchase_items WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM purchase_attachments WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM lots WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM stocks WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM stock_movements WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM sales WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM sale_items WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM payments WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM cash_sessions WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM cash_movements WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM journal_entries WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM journal_entry_lines WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM offline_stock_allocations WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM pos_sync_operations WHERE tenant_id = v_tenant_id
    UNION ALL SELECT COUNT(*) FROM pos_sync_conflicts WHERE tenant_id = v_tenant_id
  ) remaining;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Post-cleanup transactional rows remain: %', v_count;
  END IF;

  IF (SELECT COALESCE(SUM(quantity_available), 0) FROM stocks WHERE tenant_id = v_tenant_id) <> 0 THEN
    RAISE EXCEPTION 'Post-cleanup stock quantity is not zero';
  END IF;

  IF (SELECT last_number FROM purchase_number_counters WHERE tenant_id = v_tenant_id) <> 0 THEN
    RAISE EXCEPTION 'Post-cleanup purchase counter is not zero';
  END IF;

  SELECT
    COALESCE(SUM(row_count), 0)::int
  INTO v_after_other_tenants
  FROM (
    SELECT COUNT(*) AS row_count FROM purchases WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM sales WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM lots WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM stocks WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM stock_movements WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM payments WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM cash_sessions WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM cash_movements WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM journal_entries WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM journal_entry_lines WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM offline_stock_allocations WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM pos_sync_operations WHERE tenant_id <> v_tenant_id
    UNION ALL SELECT COUNT(*) FROM pos_sync_conflicts WHERE tenant_id <> v_tenant_id
  ) snapshot;

  IF v_before_other_tenants <> v_after_other_tenants THEN
    RAISE EXCEPTION 'Other tenant transactional row count changed: before %, after %', v_before_other_tenants, v_after_other_tenants;
  END IF;
END $$;
