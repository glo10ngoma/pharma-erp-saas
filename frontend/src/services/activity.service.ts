import { apiClient } from './apiClient';

export type ActivityEvent = {
  occurredAt: string;
  activityType: 'AUDIT' | 'COMMENT' | 'CHAT';
  recordId: string;
  label: string;
  userName?: string | null;
  siteName?: string | null;
  workstationName?: string | null;
  cashSessionId?: string | null;
};

export const activityService = {
  getRecent: (limit = 50) => apiClient.get<ActivityEvent[]>('/activity/recent', { params: { limit } }),
};
