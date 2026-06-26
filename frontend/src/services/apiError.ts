const LABELS: Record<string, string> = {
  STOCK_INSUFFICIENT: 'Stock insuffisant.',
  LOT_EXPIRED: 'Le lot est expire.',
  LOT_BLOCKED: 'Le lot est bloque.',
  PURCHASE_NOT_DRAFT: 'Cet achat n est plus modifiable.',
  SALE_NOT_DRAFT: 'Cette vente n est plus modifiable.',
  CASH_SESSION_ALREADY_OPEN: 'Une session caisse est deja ouverte pour ce site.',
  PAYMENT_INSUFFICIENT: 'Le paiement est insuffisant.',
  INVALID_OLD_PASSWORD: 'Ancien mot de passe incorrect.',
  PASSWORD_CONFIRMATION_MISMATCH: 'La confirmation ne correspond pas au nouveau mot de passe.',
  PASSWORD_REUSE_NOT_ALLOWED: 'Le nouveau mot de passe doit etre different de l ancien.',
  PERMISSION_DENIED: 'Permission refusee.',
  SITE_NOT_ALLOWED: 'Ce site n est pas autorise pour votre utilisateur.',
  CUSTOMER_REQUIRED_FOR_INSURANCE: 'Un client est obligatoire pour une vente assurance.',
  MEMBERSHIP_NOT_ACTIVE: 'Aucune affiliation assurance active.',
  INSURANCE_PLAN_NOT_ACTIVE: 'Le plan assurance n est pas actif.',
  ORGANIZATION_NOT_IN_TENANT: 'Organisation invalide pour ce tenant.',
  RECEIVABLE_PAYMENT_TOO_HIGH: 'Le paiement depasse le solde de la creance.',
  INVENTORY_NOT_DRAFT: 'Cet inventaire ne peut plus etre demarre.',
  INVENTORY_NOT_IN_PROGRESS: 'Cet inventaire n est pas en cours.',
  INVENTORY_NOT_CLOSED: 'Cet inventaire doit etre cloture avant validation.',
  INVENTORY_ALREADY_VALIDATED: 'Cet inventaire est deja valide.',
  INVENTORY_VALIDATED_LOCKED: 'Cet inventaire valide ne peut plus etre modifie.',
  INVENTORY_EMPTY: 'Impossible de valider un inventaire vide.',
  INVENTORY_ITEM_NOT_COUNTED: 'Toutes les lignes doivent etre comptees.',
  STOCK_NOT_FOUND: 'Stock introuvable pour ce lot.',
  TRANSFER_NOT_DRAFT: 'Ce transfert ne peut plus etre modifie.',
  TRANSFER_EMPTY: 'Impossible de valider un transfert vide.',
  TRANSFER_SAME_SITE: 'Le site source doit etre different du site destination.',
  INVALID_TRANSFER_QUANTITY: 'Quantite de transfert invalide.',
};

export function apiErrorMessage(error: unknown) {
  const response = error as { response?: { data?: { message?: string; error?: string } } };
  const code = response.response?.data?.message || response.response?.data?.error;
  return code ? LABELS[code] ?? code : 'Action impossible pour le moment.';
}
