import { useAuth } from '../auth/AuthContext';

export function usePermission() {
  const { permissions } = useAuth();

  return {
    can: (permission: string) => permissions.includes(permission),
  };
}
