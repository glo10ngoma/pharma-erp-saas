import { apiClient } from './apiClient';
import {
  type PosSyncBootstrapPayload,
  type PosSyncChangesPayload,
} from '../modules/offline/offline-types';

export type PosSyncPingResponse = {
  status: 'OK';
  serverTime: string;
  appVersion: string;
};

export type RegisterPosWorkstationPayload = {
  deviceId: string;
  workstationName: string;
  siteId: string;
  appVersion?: string;
};

export type PosSyncRegisteredWorkstation = {
  workstationId: string;
  siteId: string;
  siteCode: string | null;
  siteName: string | null;
  workstationCode: string | null;
  workstationName: string;
  workstationType: string;
  deviceUuid: string | null;
  offlineStatus: string;
  syncState: string;
  updatedAt: string | null;
};

export type PosSyncBootstrapParams = {
  workstationId?: string;
  deviceId?: string;
};

export type PosSyncChangesParams = {
  workstationId?: string;
  deviceId?: string;
  cursor?: string;
};

export const posSyncService = {
  ping: () => apiClient.get<PosSyncPingResponse>('/pos-sync/ping'),
  registerWorkstation: (payload: RegisterPosWorkstationPayload) =>
    apiClient.post<PosSyncRegisteredWorkstation>('/pos-sync/workstations/register', payload),
  bootstrap: (params: PosSyncBootstrapParams) =>
    apiClient.get<PosSyncBootstrapPayload>('/pos-sync/bootstrap', { params }),
  getChanges: (params: PosSyncChangesParams) =>
    apiClient.get<PosSyncChangesPayload>('/pos-sync/changes', { params }),
};
