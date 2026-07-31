import { apiClient } from './apiClient';

export type ChatThread = {
  threadId: string;
  tenantId: string;
  siteId?: string | null;
  siteName?: string | null;
  title: string;
  threadType: string;
  createdBy?: string | null;
  createdByName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  participantCount: number;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
};

export type ChatMessage = {
  messageId: string;
  tenantId: string;
  threadId: string;
  authorId: string;
  authorName?: string | null;
  siteId?: string | null;
  messageType: string;
  messageText: string;
  cashSessionId?: string | null;
  workstationId?: string | null;
  workstationName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const chatService = {
  getThreads: () => apiClient.get<ChatThread[]>('/chat/threads'),
  getThread: (threadId: string) => apiClient.get<ChatThread>(`/chat/threads/${threadId}`),
  createThread: (payload: Record<string, unknown>) => apiClient.post<ChatThread>('/chat/threads', payload),
  getMessages: (threadId: string) => apiClient.get<ChatMessage[]>(`/chat/threads/${threadId}/messages`),
  sendMessage: (threadId: string, payload: Record<string, unknown>) => apiClient.post<ChatMessage>(`/chat/threads/${threadId}/messages`, payload),
};
