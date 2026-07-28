import { apiClient } from './apiClient';

export type CategoryItem = { categoryId: string; categoryCode: string; categoryName: string; description: string | null; isActive: boolean };
export type SubCategoryItem = { subCategoryId: string; categoryId: string; categoryName: string | null; subCategoryCode: string; subCategoryName: string; description: string | null; isActive: boolean };
export type GalenicFormItem = { formId: string; formCode: string; formName: string };
export type AdministrationRouteItem = { routeId: string; routeCode: string; routeName: string };
export type ProductTypeItem = { productTypeId: string; typeCode: string; typeName: string };
export type SupplierItem = { supplierId: string; supplierCode: string; supplierName: string; phone: string | null; email: string | null; address: string | null; isActive: boolean };
export type CustomerItem = { customerId: string; customerCode: string; customerName: string; customerType: string; phone: string | null; email: string | null; creditAllowed: boolean; creditLimit: number; isActive: boolean };
export type ProductUnitItem = { productUnitId: string; unitCode: string; unitLabel: string; isActive: boolean };
export type DosageItem = { dosageId: string; dosageLabel: string; isActive: boolean };
export type ActiveIngredientItem = { activeIngredientId: string; canonicalName: string; isActive: boolean };
export type AtcCodeItem = { atcId: string; atcCode: string; atcLabel: string; level: string | null; parentCode: string | null; isActive: boolean };

export const referenceService = {
  categories: {
    getAll: () => apiClient.get<CategoryItem[]>('/categories'),
    create: (payload: Record<string, unknown>) => apiClient.post<CategoryItem>('/categories', payload),
  },
  subCategories: {
    getAll: () => apiClient.get<SubCategoryItem[]>('/sub-categories'),
    create: (payload: Record<string, unknown>) => apiClient.post<SubCategoryItem>('/sub-categories', payload),
  },
  galenicForms: {
    getAll: () => apiClient.get<GalenicFormItem[]>('/galenic-forms'),
    create: (payload: Record<string, unknown>) => apiClient.post<GalenicFormItem>('/galenic-forms', payload),
  },
  administrationRoutes: {
    getAll: () => apiClient.get<AdministrationRouteItem[]>('/administration-routes'),
    create: (payload: Record<string, unknown>) => apiClient.post<AdministrationRouteItem>('/administration-routes', payload),
  },
  productTypes: {
    getAll: () => apiClient.get<ProductTypeItem[]>('/product-types'),
    create: (payload: Record<string, unknown>) => apiClient.post<ProductTypeItem>('/product-types', payload),
  },
  suppliers: {
    getAll: () => apiClient.get<SupplierItem[]>('/suppliers'),
    create: (payload: Record<string, unknown>) => apiClient.post<SupplierItem>('/suppliers', payload),
  },
  customers: {
    getAll: () => apiClient.get<CustomerItem[]>('/customers'),
    create: (payload: Record<string, unknown>) => apiClient.post<CustomerItem>('/customers', payload),
  },
  productUnits: {
    getAll: () => apiClient.get<ProductUnitItem[]>('/product-units'),
    create: (payload: Record<string, unknown>) => apiClient.post<ProductUnitItem>('/product-units', payload),
  },
  dosages: {
    getAll: () => apiClient.get<DosageItem[]>('/dosages'),
    create: (payload: Record<string, unknown>) => apiClient.post<DosageItem>('/dosages', payload),
  },
  activeIngredients: {
    getAll: () => apiClient.get<ActiveIngredientItem[]>('/active-ingredients'),
    create: (payload: Record<string, unknown>) => apiClient.post<ActiveIngredientItem>('/active-ingredients', payload),
  },
  atcCodes: {
    getAll: () => apiClient.get<AtcCodeItem[]>('/atc-codes'),
    create: (payload: Record<string, unknown>) => apiClient.post<AtcCodeItem>('/atc-codes', payload),
  },
};
