export function organizationSelectionError(error: unknown): string {
  const failure = error as { response?: { status?: number; data?: { message?: unknown } }; code?: string } | null;
  const status = failure?.response?.status;
  const message = failure?.response?.data?.message;
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous pour continuer.';
  if (status === 403 || message === 'TENANT_NOT_ALLOWED') return 'Votre compte n’est pas autorisé à accéder à cette organisation. Contactez votre administrateur.';
  if (status && status >= 500) return 'Le service rencontre une erreur. Réessayez dans quelques instants. Si le problème persiste, contactez votre administrateur.';
  if (!status && ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(failure?.code ?? '')) return 'Le serveur est injoignable. Vérifiez votre connexion Internet puis réessayez.';
  return 'L’ouverture n’a pas pu aboutir. Actualisez la liste puis réessayez.';
}
