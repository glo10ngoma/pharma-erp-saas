import { getOfflineCartPageModel } from './offline-cart';
import {
  bootstrapFromServer,
  calculateAuthorizationState,
  loadLocalSnapshot,
  verifyLocalWorkstationRegistration,
  type OfflineSnapshotViewModel,
} from './offline-bootstrap';
import { canAttachOfflineCashSale, openOfflineCashSession } from './offline-cash';
import { runSync } from './sync-engine';

type OfflinePageModel = Awaited<ReturnType<typeof getOfflineCartPageModel>>;

export type OfflineEnvironmentState =
  | 'PREPARING'
  | 'READY'
  | 'OFFLINE_READY'
  | 'ACTION_REQUIRED'
  | 'REVOKED';

export type OfflineEnvironmentResult = {
  state: OfflineEnvironmentState;
  viewModel: OfflineSnapshotViewModel;
  pageModel: OfflinePageModel | null;
  message: string | null;
};

export async function ensureOfflineWorkstationReady(options?: {
  preferredSiteId?: string | null;
}) {
  const localView = await loadLocalSnapshot();
  const preferredSiteId = options?.preferredSiteId ?? localView.snapshot.workstation?.siteId ?? localView.snapshot.auth?.siteId ?? null;

  if (localView.networkStatus !== 'ONLINE') {
    return localView;
  }

  const localAuthorization = calculateAuthorizationState(localView.snapshot.auth, localView.snapshot.workstation);
  const hasContext = Boolean(
    localView.snapshot.workstation?.workstationId
    && localView.snapshot.auth?.tenantId
    && localView.snapshot.settings,
  );

  if (hasContext && localAuthorization === 'AUTHORIZED') {
    const registrationState = await verifyLocalWorkstationRegistration(localView.snapshot);
    if (registrationState.state === 'AUTHORIZED') {
      return localView;
    }
  }

  await bootstrapFromServer({
    siteId: preferredSiteId,
  });
  return loadLocalSnapshot();
}

export async function ensureOfflineEnvironmentReady(options?: {
  cartId?: string | null;
  preferredSiteId?: string | null;
}) {
  let viewModel = await ensureOfflineWorkstationReady({ preferredSiteId: options?.preferredSiteId ?? null });
  let snapshot = viewModel.snapshot;
  let authorizationState = calculateAuthorizationState(snapshot.auth, snapshot.workstation);

  if (
    viewModel.networkStatus === 'ONLINE'
    && snapshot.settings?.autoBootstrap !== false
    && authorizationState === 'AUTHORIZED'
    && (
      !snapshot.settings
      || snapshot.articles.length === 0
      || snapshot.allocations.length === 0
    )
  ) {
    await bootstrapFromServer({
      siteId: options?.preferredSiteId ?? snapshot.workstation?.siteId ?? snapshot.auth?.siteId ?? null,
    });
    void runSync('online');
    viewModel = await loadLocalSnapshot();
    snapshot = viewModel.snapshot;
    authorizationState = calculateAuthorizationState(snapshot.auth, snapshot.workstation);
  }

  if (
    snapshot.settings?.autoOpenCashSession
    && authorizationState === 'AUTHORIZED'
    && snapshot.auth?.permissions.includes('cash_sessions.open')
    && !canAttachOfflineCashSale(snapshot.cashSession)
  ) {
    try {
      await openOfflineCashSession({
        openingBalanceUsd: 0,
        openingBalanceCdf: 0,
        note: 'Ouverture automatique offline',
      });
      viewModel = await loadLocalSnapshot();
      snapshot = viewModel.snapshot;
      authorizationState = calculateAuthorizationState(snapshot.auth, snapshot.workstation);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? 'OFFLINE_ENVIRONMENT_ERROR');
      if (!['PERMISSION_DENIED', 'OFFLINE_AUTH_UNAUTHORIZED', 'WORKSTATION_REVOKED'].includes(message)) {
        throw error;
      }
    }
  }

  const pageModel = authorizationState === 'AUTHORIZED'
    ? await getOfflineCartPageModel(options?.cartId ?? null)
    : null;

  if (authorizationState === 'REVOKED') {
    return {
      state: 'REVOKED',
      viewModel,
      pageModel: null,
      message: 'Ce poste a ete revoque. Une verification responsable est requise.',
    } satisfies OfflineEnvironmentResult;
  }

  if (
    authorizationState === 'AUTHORIZED'
    && snapshot.workstation?.workstationId
    && snapshot.settings
    && snapshot.articles.length > 0
    && pageModel
  ) {
    return {
      state: viewModel.networkStatus === 'ONLINE' ? 'READY' : 'OFFLINE_READY',
      viewModel,
      pageModel,
      message: null,
    } satisfies OfflineEnvironmentResult;
  }

  const actionableMessage = viewModel.networkStatus === 'OFFLINE'
    ? 'Ce poste doit etre prepare une premiere fois avec Internet.'
    : 'Preparation automatique en cours ou contexte local incomplet.';

  return {
    state: 'ACTION_REQUIRED',
    viewModel,
    pageModel,
    message: actionableMessage,
  } satisfies OfflineEnvironmentResult;
}
