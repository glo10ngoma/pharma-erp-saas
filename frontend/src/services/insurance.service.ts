import { apiClient } from './apiClient';

export type Organization = { organizationId: string; organizationCode: string; organizationName: string; organizationType: string; phone: string | null; email: string | null; creditAllowed: boolean; creditLimit: number; paymentTermsDays: number; isActive: boolean };
export type InsurancePlan = { planId: string; organizationId: string; organizationName: string | null; planCode: string; planName: string; coveragePercent: number; patientCopayPercent: number; isActive: boolean };
export type Membership = { membershipId: string; customerId: string; customerName: string | null; organizationId: string; organizationName: string | null; planId: string | null; planName: string | null; coveragePercent: number | null; memberNumber: string | null; isActive: boolean };
export type Receivable = { receivableId: string; saleId: string | null; customerName: string | null; organizationName: string | null; receivableType: string; amountDue: number; amountPaid: number; balance: number; status: string };

export const insuranceService = {
  organizations: {
    getAll: () => apiClient.get<Organization[]>('/organizations'),
    create: (payload: Record<string, unknown>) => apiClient.post<Organization>('/organizations', payload),
    update: (id: string, payload: Record<string, unknown>) => apiClient.patch<Organization>(`/organizations/${id}`, payload),
    disable: (id: string) => apiClient.post<Organization>(`/organizations/${id}/disable`),
  },
  plans: {
    getAll: () => apiClient.get<InsurancePlan[]>('/insurance-plans'),
    create: (payload: Record<string, unknown>) => apiClient.post<InsurancePlan>('/insurance-plans', payload),
    update: (id: string, payload: Record<string, unknown>) => apiClient.patch<InsurancePlan>(`/insurance-plans/${id}`, payload),
  },
  memberships: {
    getAll: () => apiClient.get<Membership[]>('/memberships'),
    create: (payload: Record<string, unknown>) => apiClient.post<Membership>('/memberships', payload),
    getByCustomer: (customerId: string) => apiClient.get<Membership[]>(`/customers/${customerId}/memberships`),
  },
  receivables: {
    getAll: () => apiClient.get<Receivable[]>('/receivables'),
    summary: () => apiClient.get('/receivables/summary'),
    pay: (id: string, payload: Record<string, unknown>) => apiClient.post<Receivable>(`/receivables/${id}/pay`, payload),
  },
};
