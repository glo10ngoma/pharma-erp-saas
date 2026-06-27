import { apiClient } from './apiClient';

export type ExchangeRateSetting = {
  baseCurrency: 'USD';
  quoteCurrency: 'CDF';
  rate: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const settingsService = {
  getExchangeRate: () => apiClient.get<ExchangeRateSetting>('/settings/exchange-rate'),
  updateExchangeRate: (rate: number) => apiClient.put<ExchangeRateSetting>('/settings/exchange-rate', { rate }),
};
