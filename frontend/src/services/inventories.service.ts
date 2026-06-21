import { apiClient } from './apiClient';

export type InventoryItem = {
  inventoryItemId: string;
  inventoryId: string;
  articleId: string;
  articleCode: string | null;
  commercialName: string | null;
  lotId: string;
  lotNumber: string | null;
  expiryDate: string | null;
  systemQuantity: number;
  physicalQuantity: number | null;
  differenceQuantity: number | null;
  reason: string | null;
};

export type Inventory = {
  inventoryId: string;
  siteId: string;
  siteName: string | null;
  inventoryNumber: string;
  inventoryType: string;
  inventoryDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
  validatedAt: string | null;
  items?: InventoryItem[];
};

export const inventoriesService = {
  getAll: () => apiClient.get<Inventory[]>('/inventories'),
  getById: (id: string) => apiClient.get<Inventory>(`/inventories/${id}`),
  create: (payload: Record<string, unknown>) => apiClient.post<Inventory>('/inventories', payload),
  start: (id: string) => apiClient.post<Inventory>(`/inventories/${id}/start`),
  close: (id: string) => apiClient.post<Inventory>(`/inventories/${id}/close`),
  validate: (id: string) => apiClient.post<Inventory>(`/inventories/${id}/validate`),
  getItems: (id: string) => apiClient.get<InventoryItem[]>(`/inventories/${id}/items`),
  addItem: (id: string, payload: Record<string, unknown>) => apiClient.post<InventoryItem[]>(`/inventories/${id}/items`, payload),
  updateItem: (id: string, itemId: string, payload: Record<string, unknown>) => apiClient.patch<InventoryItem[]>(`/inventories/${id}/items/${itemId}`, payload),
};
