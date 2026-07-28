BEGIN;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS amount_paid_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_returned_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_returned_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_received_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_received_cdf NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_difference_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_difference_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS settlement_difference_reason VARCHAR(150),
  ADD COLUMN IF NOT EXISTS settlement_difference_note TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cash_movements_movement_type_check'
      AND conrelid = 'cash_movements'::regclass
  ) THEN
    ALTER TABLE cash_movements DROP CONSTRAINT cash_movements_movement_type_check;
  END IF;
END $$;

ALTER TABLE cash_movements
  ADD CONSTRAINT cash_movements_movement_type_check
  CHECK (
    movement_type IN (
      'SALE_PAYMENT',
      'SALE_CHANGE',
      'RECEIVABLE_PAYMENT',
      'CASH_IN',
      'CASH_OUT',
      'EXPENSE',
      'BANK_DEPOSIT',
      'ADVANCE',
      'ADJUSTMENT'
    )
  );

COMMIT;
