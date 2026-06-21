-- Sprint 8 - Contraintes minimales pour Inventaires Physiques
-- Justification :
-- - Le schema V3 existant n'autorisait pas les statuts IN_PROGRESS/CLOSED.
-- - stock_movements n'autorisait pas INVENTORY_GAIN/INVENTORY_LOSS.
-- Aucune table ni colonne n'est ajoutee.

ALTER TABLE inventory_sessions
  DROP CONSTRAINT IF EXISTS inventory_sessions_status_check;

ALTER TABLE inventory_sessions
  ADD CONSTRAINT inventory_sessions_status_check
  CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'CLOSED', 'VALIDATED', 'CANCELLED'));

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (
    movement_type IN (
      'PURCHASE_IN',
      'SALE_OUT',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'RETURN_IN',
      'RETURN_OUT',
      'EXPIRED_OUT',
      'INVENTORY_GAIN',
      'INVENTORY_LOSS'
    )
  );
