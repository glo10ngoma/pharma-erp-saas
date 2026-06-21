export function usePermission() {
  const raw = localStorage.getItem('permissions');
  const permissions = raw ? JSON.parse(raw) : [];

  return {
    can: (permission: string) => permissions.includes(permission),
  };
}
