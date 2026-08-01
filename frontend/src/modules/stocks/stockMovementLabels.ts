import { StockMovement, StockMovementDirection } from '../../services/stocks.service';

const TYPE_LABELS: Record<string, string> = {
  PURCHASE_IN: 'Entrée achat',
  SALE_OUT: 'Sortie vente',
  INVENTORY_GAIN: "Gain d'inventaire",
  INVENTORY_LOSS: "Perte d'inventaire",
  TRANSFER_OUT: 'Transfert sortant',
  TRANSFER_IN: 'Transfert entrant',
  PURCHASE_RETURN_OUT: 'Retour fournisseur',
  PURCHASE_EXCHANGE_IN: 'Produit reçu en échange',
  MANUAL_ADJUSTMENT_IN: 'Ajustement positif',
  MANUAL_ADJUSTMENT_OUT: 'Ajustement négatif',
  STOCK_ENTRY: 'Entrée stock',
  STOCK_OUTPUT: 'Sortie stock',
  EXPIRED_OUT: 'Sortie pour péremption',
  DAMAGED_OUT: 'Sortie pour détérioration',
  ADJUSTMENT_IN: 'Ajustement positif',
  ADJUSTMENT_OUT: 'Ajustement négatif',
  RETURN_IN: 'Retour entrant',
  RETURN_OUT: 'Retour sortant',
};

export function stockMovementLabel(type?: string | null) {
  if (!type) return 'Autre mouvement';
  return TYPE_LABELS[type] ?? type;
}

export function stockMovementDirectionLabel(direction?: StockMovementDirection | null) {
  if (direction === 'IN') return 'Entrée';
  if (direction === 'OUT') return 'Sortie';
  return 'Autre';
}

export function stockMovementDirectionClass(direction?: StockMovementDirection | null) {
  if (direction === 'IN') return 'badge-success';
  if (direction === 'OUT') return 'badge-danger';
  return 'badge-muted';
}

export function stockMovementSignedQuantity(movement: StockMovement) {
  const prefix = movement.direction === 'IN' ? '+' : movement.direction === 'OUT' ? '-' : '';
  return `${prefix}${movement.quantity}`;
}

export function stockMovementSourceLabel(movement: Pick<StockMovement, 'referenceLabel' | 'referenceNumber' | 'referenceType'>) {
  if (movement.referenceLabel && movement.referenceNumber) return `${movement.referenceLabel} ${movement.referenceNumber}`;
  if (movement.referenceLabel) return movement.referenceLabel;
  if (movement.referenceNumber) return movement.referenceNumber;
  if (movement.referenceType) return movement.referenceType;
  return 'Document non disponible';
}

export function stockMovementSourceRoute(movement: Pick<StockMovement, 'referenceType' | 'referenceId'>) {
  if (!movement.referenceId || !movement.referenceType) return null;
  if (movement.referenceType === 'PURCHASE') return `/purchases/${movement.referenceId}`;
  if (movement.referenceType === 'SALE') return `/sales/${movement.referenceId}`;
  if (movement.referenceType === 'INVENTORY') return `/inventories/${movement.referenceId}`;
  if (movement.referenceType === 'TRANSFER') return `/transfers/${movement.referenceId}`;
  if (movement.referenceType === 'PURCHASE_RETURN') return `/purchase-returns/${movement.referenceId}`;
  return null;
}
