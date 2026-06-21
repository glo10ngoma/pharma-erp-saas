export function filterRows<T>(rows: T[], search: string, pick: (row: T) => Array<unknown>) {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => pick(row).some((value) => String(value ?? '').toLowerCase().includes(q)));
}
