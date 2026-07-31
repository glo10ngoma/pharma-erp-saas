import { apiClient } from './apiClient';

export type CashSession = {
  cashSessionId: string;
  siteId: string;
  siteName: string | null;
  userName: string | null;
  registerName: string | null;
  registerCurrencyCode?: string | null;
  workstationId?: string | null;
  workstationName?: string | null;
  sessionLabel?: string | null;
  openedIpAddress?: string | null;
  closedIpAddress?: string | null;
  deviceUuid?: string | null;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  openingBalanceUsd?: number;
  openingBalanceCdf?: number;
  closingBalance: number | null;
  expectedClosingBalance: number;
  differenceAmount: number;
  countedClosingBalanceUsd?: number;
  countedClosingBalanceCdf?: number;
  expectedClosingBalanceUsd?: number;
  expectedClosingBalanceCdf?: number;
  closingDifferenceUsd?: number;
  closingDifferenceCdf?: number;
  status: string;
  notes: string | null;
};

export type CashMovement = {
  cashMovementId: string;
  cashSessionId: string;
  movementDate: string;
  movementType: string;
  amount: number;
  currencyCode: string | null;
  currencySymbol?: string | null;
  referenceType: string | null;
  referenceId?: string | null;
  description: string | null;
};

export const cashService = {
  getSessions: () => apiClient.get<CashSession[]>('/cash/sessions'),
  getCurrentSession: (siteId?: string, deviceUuid?: string) =>
    apiClient.get<CashSession | null>('/cash/sessions/current', {
      params: siteId || deviceUuid ? { siteId, deviceUuid } : undefined,
    }),
  openSession: (payload: Record<string, unknown>) => apiClient.post<CashSession>('/cash/sessions/open', payload),
  closeSession: (sessionId: string, payload: Record<string, unknown>) =>
    apiClient.post<CashSession>(`/cash/sessions/${sessionId}/close`, payload),
  getMovements: (sessionId?: string) =>
    apiClient.get<CashMovement[]>('/cash/movements', { params: sessionId ? { sessionId } : undefined }),
  createExpense: (payload: Record<string, unknown>) => apiClient.post<CashMovement>('/cash/expenses', payload),
};
