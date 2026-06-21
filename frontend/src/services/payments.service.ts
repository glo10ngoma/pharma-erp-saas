import { apiClient } from './apiClient';
import type { Payment } from './sales.service';

export const paymentsService = {
  getAll: () => apiClient.get<Payment[]>('/payments'),
  getBySale: (saleId: string) => apiClient.get<Payment[]>(`/payments/sale/${saleId}`),
};
