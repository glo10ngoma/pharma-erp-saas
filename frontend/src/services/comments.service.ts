import { apiClient } from './apiClient';

export type EntityComment = {
  commentId: string;
  tenantId: string;
  siteId?: string | null;
  siteName?: string | null;
  entityType: string;
  entityId: string;
  parentCommentId?: string | null;
  authorId: string;
  authorName?: string | null;
  commentText: string;
  visibilityScope: 'PUBLIC' | 'PRIVATE';
  cashSessionId?: string | null;
  workstationId?: string | null;
  workstationName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const commentsService = {
  getByEntity: (entityType: string, entityId: string) =>
    apiClient.get<EntityComment[]>('/comments', { params: { entityType, entityId } }),
  create: (payload: Record<string, unknown>) => apiClient.post<EntityComment>('/comments', payload),
  update: (commentId: string, payload: Record<string, unknown>) => apiClient.patch<EntityComment>(`/comments/${commentId}`, payload),
  remove: (commentId: string) => apiClient.delete<{ deleted: boolean }>(`/comments/${commentId}`),
};
