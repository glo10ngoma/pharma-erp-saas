ALTER TABLE cash_sessions
  ADD COLUMN IF NOT EXISTS counted_closing_balance_usd NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS counted_closing_balance_cdf NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS expected_closing_balance_usd NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS expected_closing_balance_cdf NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS closing_difference_usd NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS closing_difference_cdf NUMERIC(14,2);
