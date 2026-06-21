import { apiClient } from './apiClient';

export type ReportFilters = { from?: string; to?: string; siteId?: string };

export type DashboardKpis = {
  revenueToday: number;
  revenueMonth: number;
  totalCashSales: number;
  totalInsuranceSales: number;
  totalCashPayments: number;
  openReceivables: number;
  stockValuePurchase: number;
  stockValueSale: number;
  estimatedGrossMargin: number;
  expiredLotsCount: number;
  expiring30DaysCount: number;
  expiring90DaysCount: number;
  lowStockProductsCount: number;
};

export const reportsService = {
  dashboard: (filters?: ReportFilters) => apiClient.get<DashboardKpis>('/reports/dashboard', { params: filters }),
  sales: (filters?: ReportFilters) => apiClient.get<Array<Record<string, unknown>>>('/reports/sales', { params: filters }),
  stock: (filters?: ReportFilters) => apiClient.get<Array<Record<string, unknown>>>('/reports/stock', { params: filters }),
  margins: (filters?: ReportFilters) => apiClient.get<Array<Record<string, unknown>>>('/reports/margins', { params: filters }),
  cash: (filters?: ReportFilters) => apiClient.get<Array<Record<string, unknown>>>('/reports/cash', { params: filters }),
  receivables: (filters?: ReportFilters) => apiClient.get<Array<Record<string, unknown>>>('/reports/receivables', { params: filters }),
  expiry: (filters?: ReportFilters) => apiClient.get<Array<Record<string, unknown>>>('/reports/expiry', { params: filters }),
  topProducts: (filters?: ReportFilters) => apiClient.get<Array<Record<string, unknown>>>('/reports/top-products', { params: filters }),
};
