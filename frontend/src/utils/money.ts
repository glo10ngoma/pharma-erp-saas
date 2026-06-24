export function currencySymbol(currencyCode?: string | null, currencySymbol?: string | null) {
  if (currencySymbol) return currencySymbol;
  if (currencyCode === 'CDF') return 'FC';
  if (currencyCode === 'USD') return '$';
  return currencyCode ?? 'USD';
}

export function formatMoney(amount: number | string | null | undefined, currencyCode = 'USD', symbol?: string | null) {
  const value = Number(amount ?? 0);
  const maximumFractionDigits = currencyCode === 'CDF' ? 0 : 2;
  const minimumFractionDigits = currencyCode === 'CDF' ? 0 : 2;
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
  const suffix = currencyCode === 'CDF' ? 'FC' : currencyCode;
  if (currencyCode === 'CDF') return `${formatted} ${currencySymbol(currencyCode, symbol)}`;
  return `${formatted} ${suffix}`;
}
