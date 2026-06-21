export function usePermission() {
  const raw = localStorage.getItem('currentUser');
  const user = raw ? JSON.parse(raw) : null;
  const permissions = user?.permissions ?? [];

  return {
    can: (permission: string) => permissions.includes(permission),
  };
}
