import { apiClient } from './apiClient';

export type PriceCheckAvailability = 'AVAILABLE' | 'INSUFFICIENT_STOCK' | 'UNAVAILABLE' | 'UNREFERENCED';

export type PriceCheckQuote = {
  articleId: string;
  articleCode: string;
  articleName: string;
  barcode: string | null;
  unitId: string | null;
  unitName: string | null;
  unitPrice: number | null;
  requestedQuantity: number;
  subtotal: number;
  availableQuantity: number;
  availabilityStatus: PriceCheckAvailability;
};

export type PriceCheckItem = {
  priceCheckItemId: string;
  priceCheckId: string;
  articleId: string | null;
  articleCode: string | null;
  articleName: string;
  requestedQuantity: number;
  unitId: string | null;
  unitName: string | null;
  unitPrice: number | null;
  subtotal: number;
  availabilityStatus: PriceCheckAvailability;
  availableQuantity: number;
  manualDescription: string | null;
  lineOrder: number;
};

export type PriceCheck = {
  priceCheckId: string;
  tenantId: string;
  siteId: string;
  siteName: string | null;
  checkNumber: string;
  customerId: string | null;
  customerName: string | null;
  patientName: string | null;
  phone: string | null;
  currencyCode: string;
  exchangeRate: number;
  subtotalUsd: number;
  totalUsd: number;
  totalCdf: number;
  notes: string | null;
  status: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  items: PriceCheckItem[];
};

export type PaginatedPriceChecks = {
  items: PriceCheck[];
  total: number;
  page: number;
  limit: number;
};

export type CreatePriceCheckPayload = {
  siteId: string;
  customerId?: string | null;
  customerName?: string | null;
  patientName?: string | null;
  phone?: string | null;
  notes?: string | null;
  items: Array<{
    articleId?: string | null;
    manualDescription?: string | null;
    requestedQuantity: number;
  }>;
};

export const priceChecksService = {
  searchArticles: (params: { siteId: string; search?: string }) =>
    apiClient.get<PriceCheckQuote[]>('/price-checks/articles/search', { params }),
  list: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedPriceChecks>('/price-checks', { params }),
  getById: (id: string) =>
    apiClient.get<PriceCheck>(`/price-checks/${id}`),
  create: (payload: CreatePriceCheckPayload) =>
    apiClient.post<PriceCheck>('/price-checks', payload),
};
