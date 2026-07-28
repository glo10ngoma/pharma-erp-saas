import { apiClient } from './apiClient';

export type Article = {
  articleId: string;
  articleCode: string;
  commercialName: string;
  dci: string | null;
  dciId?: string | null;
  barcode: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  formId: string | null;
  routeId: string | null;
  productTypeId: string | null;
  dosage: string | null;
  dosageId?: string | null;
  packaging?: string | null;
  unitsPerPackage?: number | null;
  salesUnitId?: string | null;
  packagingUnitId?: string | null;
  atcCode: string | null;
  atcId?: string | null;
  prescriptionRequired: boolean;
  defaultStockMin: number;
  defaultStockMax: number | null;
  isActive: boolean;
  stockAvailable: number;
  sellingPrice: number | null;
};

export type PaginatedArticles = {
  items: Article[];
  total: number;
  page: number;
  limit: number;
};

export const articlesService = {
  getAll: (params?: Record<string, unknown>) =>
    apiClient.get<PaginatedArticles>('/articles', { params }),

  getById: (id: string) =>
    apiClient.get(`/articles/${id}`),

  create: (payload: Record<string, unknown>) =>
    apiClient.post<Article>('/articles', payload),

  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch<Article>(`/articles/${id}`, payload),
};
