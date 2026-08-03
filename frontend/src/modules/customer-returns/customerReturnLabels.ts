export function customerReturnStatusLabel(status?: string | null) {
  if (!status) return '-';
  if (status === 'DRAFT') return 'Brouillon';
  if (status === 'PENDING_INSPECTION') return 'En inspection';
  if (status === 'APPROVED') return 'Approuve';
  if (status === 'REJECTED') return 'Rejete';
  if (status === 'VALIDATED') return 'Valide';
  if (status === 'CANCELLED') return 'Annule';
  return status;
}

export function customerReturnStatusClass(status?: string | null) {
  if (status === 'VALIDATED' || status === 'APPROVED') return 'badge-success';
  if (status === 'PENDING_INSPECTION') return 'badge-info';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'badge-muted';
  return 'badge-warning';
}

export function customerReturnConditionLabel(condition?: string | null) {
  if (!condition) return '-';
  if (condition === 'GOOD') return 'Bon etat';
  if (condition === 'OPENED') return 'Ouvert';
  if (condition === 'DAMAGED') return 'Endommage';
  if (condition === 'EXPIRED') return 'Expire';
  if (condition === 'WRONG_PRODUCT') return 'Mauvais produit';
  if (condition === 'OTHER') return 'Autre';
  return condition;
}

export function customerReturnSettlementKindLabel(kind?: string | null) {
  if (!kind) return '-';
  if (kind === 'REFUND') return 'Remboursement';
  if (kind === 'ADDITIONAL_PAYMENT') return 'Complement client';
  if (kind === 'CUSTOMER_CREDIT') return 'Avoir client';
  return kind;
}

export function customerReturnPaymentSourceLabel(source?: string | null) {
  if (!source) return '-';
  if (source === 'CASH_REGISTER') return 'Especes / caisse';
  if (source === 'BANK') return 'Banque';
  if (source === 'MOBILE_MONEY') return 'Mobile Money';
  if (source === 'CUSTOMER_CREDIT') return 'Avoir client';
  if (source === 'OTHER') return 'Autre';
  return source;
}

export function customerCreditStatusLabel(status?: string | null) {
  if (!status) return '-';
  if (status === 'AVAILABLE') return 'Disponible';
  if (status === 'PARTIALLY_USED') return 'Partiellement utilise';
  if (status === 'USED') return 'Utilise';
  if (status === 'CANCELLED') return 'Annule';
  return status;
}
