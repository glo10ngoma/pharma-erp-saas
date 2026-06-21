import { apiClient } from './apiClient';

export type Article = {
  articleId: string;
  articleCode: string;
  commercialName: string;
  dci: string | null;
  barcode: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  formId: string | null;
  routeId: string | null;
  productTypeId: string | null;
  dosage: string | null;
  atcCode: string | null;
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
};
