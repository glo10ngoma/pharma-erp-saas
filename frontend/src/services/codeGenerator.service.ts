import { apiClient } from './apiClient';

export const codeGeneratorService = {
  next: (entity: string) => apiClient.get<{ entity: string; code: string }>('/code-generator/next', { params: { entity } }),
};
