export const RETURN_CONDITION_OPTIONS = [
  { value: 'GOOD', label: 'Bon état' },
  { value: 'DAMAGED', label: 'Endommagé' },
  { value: 'EXPIRED', label: 'Périmé' },
  { value: 'NON_COMPLIANT', label: 'Non conforme' },
  { value: 'WRONG_PRODUCT', label: 'Mauvais produit' },
  { value: 'OTHER', label: 'Autre' },
] as const;

export const RETURN_TYPE_LABELS: Record<string, string> = {
  REFUND: 'Remboursement',
  CREDIT_NOTE: 'Avoir fournisseur',
  EXCHANGE: 'Échange',
  MIXED: 'Mixte',
};

export const SETTLEMENT_KIND_OPTIONS = [
  { value: 'REFUND', label: 'Remboursement fournisseur', help: 'Le fournisseur rembourse la différence.' },
  { value: 'ADDITIONAL_PAYMENT', label: 'Complément payé', help: "L'entreprise règle un complément au fournisseur." },
  { value: 'SUPPLIER_CREDIT', label: 'Avoir fournisseur', help: 'La différence devient un crédit utilisable plus tard.' },
] as const;

export const SETTLEMENT_FLOW_OPTIONS = [
  { value: 'NONE', label: 'Aucun règlement', help: 'Aucun mouvement financier ne sera créé.' },
  { value: 'REFUND', label: 'Remboursement fournisseur', help: 'Le fournisseur rembourse la différence.' },
  { value: 'SUPPLIER_CREDIT', label: 'Avoir fournisseur', help: 'La différence devient un crédit utilisable plus tard.' },
  { value: 'ADDITIONAL_PAYMENT', label: 'Complément payé', help: "L'entreprise règle un complément au fournisseur." },
  { value: 'MIXED', label: 'Régularisation mixte', help: 'Ajoutez plusieurs lignes de régularisation pour répartir le traitement.' },
] as const;

export const PAYMENT_SOURCE_OPTIONS = [
  { value: 'CASH_REGISTER', label: 'Caisse' },
  { value: 'BANK', label: 'Banque' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
  { value: 'SUPPLIER_CREDIT', label: 'Avoir fournisseur' },
  { value: 'OTHER', label: 'Autre' },
] as const;

function optionLabel<T extends readonly { value: string; label: string }[]>(options: T, value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function getReturnConditionLabel(value: string) {
  return optionLabel(RETURN_CONDITION_OPTIONS, value);
}

export function getReturnTypeLabel(value: string) {
  return RETURN_TYPE_LABELS[value] ?? value;
}

export function getSettlementKindLabel(value: string) {
  return optionLabel(SETTLEMENT_KIND_OPTIONS, value);
}

export function getSettlementFlowLabel(value: string) {
  return optionLabel(SETTLEMENT_FLOW_OPTIONS, value);
}

export function getPaymentSourceLabel(value: string) {
  return optionLabel(PAYMENT_SOURCE_OPTIONS, value);
}
