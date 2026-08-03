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
