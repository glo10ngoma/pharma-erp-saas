import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
import { canAttachOfflineCashSale } from './offline-cash';
import { type OfflineSnapshotViewModel } from './offline-bootstrap';
import { type OfflineCashSessionSnapshot, type OfflineSale } from './offline-types';
import { type useSyncEngine } from './useSyncEngine';

export function mapOfflineSellerMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? 'LOCAL_STORAGE_ERROR');
  const code = raw.toUpperCase();
  const messages: Record<string, string> = {
    OFFLINE_AUTH_EXPIRED: 'L autorisation hors ligne de ce poste a expire. Reconnectez-vous a Internet.',
    WORKSTATION_REVOKED: 'Ce poste n est plus autorise a effectuer des ventes hors ligne.',
    SNAPSHOT_EXPIRED: 'Les donnees locales sont trop anciennes. Reconnectez Internet puis synchronisez.',
    STORAGE_CRITICAL: 'Le stockage local du poste est presque plein. Contactez un responsable.',
    RECOVERY_REQUIRED: 'Une verification locale est requise avant de continuer les ventes hors ligne.',
    PAYMENT_INSUFFICIENT: 'Le paiement saisi est insuffisant.',
    CASH_SESSION_REQUIRED: 'Ouvrez la caisse avant d encaisser une vente.',
    CASH_SESSION_CLOSED: 'La caisse locale est fermee. Ouvrez une nouvelle session.',
    OFFLINE_ALLOCATION_INSUFFICIENT: 'Le stock hors ligne disponible sur ce poste est insuffisant.',
    ALLOCATION_INSUFFICIENT: 'Le stock hors ligne disponible sur ce poste est insuffisant.',
    ALLOCATION_REVOKED: 'Le quota hors ligne de ce poste a ete revoque.',
    ALLOCATION_SUSPENDED: 'Le quota hors ligne de ce poste est suspendu.',
    SYNC_CONFLICT: 'Une operation necessite la verification d un responsable.',
    INTERNAL_SERVER_ERROR: 'Une erreur technique est survenue. La vente locale reste conservee si elle a ete encaissee.',
  };
  return messages[code] ?? (code.includes('CONFLICT') ? messages.SYNC_CONFLICT : raw);
}

export function OfflineSellerNav() {
  const location = useLocation();
  const links = [
    ['/offline/pos', 'POS'],
    ['/offline/drafts', 'Brouillons'],
    ['/offline/sales', 'Ventes'],
    ['/offline/cash', 'Caisse'],
    ['/offline/synchronisation', 'Synchronisation'],
    ['/offline/poste', 'Poste'],
  ];
  return (
    <nav className="offline-seller-nav" aria-label="Navigation POS Offline">
      {links.map(([to, label]) => (
        <Link key={to} className={location.pathname === to ? 'is-active' : ''} to={to}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

type OfflineWorkspaceMode = 'seller' | 'admin';

export function OfflineWorkspaceLayout(props: {
  mode: OfflineWorkspaceMode;
  viewModel: OfflineSnapshotViewModel;
  syncEngine?: ReturnType<typeof useSyncEngine>;
  cashSession?: OfflineCashSessionSnapshot | null;
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  topActions?: ReactNode;
  exitTo?: string;
  children: ReactNode;
}) {
  const location = useLocation();
  const { permissions } = useAuth();
  const isPosFullscreen = props.mode === 'seller' && location.pathname === '/offline/pos';
  const showSellerAction = props.mode === 'seller';
  const sellerLinks = [
    { to: '/offline/pos', label: 'POS', short: 'POS', permission: 'pos_sync.read' },
    { to: '/offline/drafts', label: 'Brouillons', short: 'BRO', permission: 'pos_sync.read' },
    { to: '/offline/sales', label: 'Ventes', short: 'VNT', permission: 'pos_sync.read' },
    { to: '/offline/cash', label: 'Caisse', short: 'CSH', permission: 'pos_sync.read' },
    { to: '/offline/synchronisation', label: 'Synchronisation', short: 'SYN', permission: 'pos_sync.read' },
    { to: '/offline/poste', label: 'Poste', short: 'PST', permission: 'pos_sync.read' },
  ].filter((item) => permissions.includes(item.permission));
  const adminLinks = [
    { to: '/offline-admin/dashboard', label: 'Dashboard', short: 'DAS', permission: 'pos_offline.admin.read' },
    { to: '/offline-admin/workstations', label: 'Postes', short: 'WKS', permission: 'pos_offline.workstations.read' },
    { to: '/offline-admin/allocations', label: 'Allocations', short: 'ALC', permission: 'offline_allocations.read' },
    { to: '/offline-admin/conflicts', label: 'Conflits', short: 'CFL', permission: 'pos_sync.conflicts.read' },
    { to: '/offline-admin/cash-sessions', label: 'Sessions caisse', short: 'SES', permission: 'pos_sync.read' },
    { to: '/offline-admin/logs', label: 'Logs', short: 'LOG', permission: 'pos_sync.logs.read' },
  ].filter((item) => permissions.includes(item.permission));
  const workstation = props.viewModel.snapshot.workstation;
  const auth = props.viewModel.snapshot.auth;
  const networkText = props.viewModel.networkStatus === 'ONLINE'
    ? 'En ligne'
    : props.viewModel.networkStatus === 'DEGRADED'
      ? 'Connexion limitee'
      : 'Hors ligne';
  const syncText = props.syncEngine?.conflictCount
    ? `${props.syncEngine.conflictCount} conflit(s)`
    : props.syncEngine?.pendingCount
      ? `${props.syncEngine.pendingCount} en attente`
      : 'Synchronise';
  const cashText = canAttachOfflineCashSale(props.cashSession ?? null) ? 'Caisse ouverte' : 'Caisse fermee';

  function renderNavSection(title: string, links: typeof sellerLinks) {
    if (links.length === 0) return null;
    return (
      <div className="offline-sidebar-group">
        <span className="offline-sidebar-label">{title}</span>
        <div className="offline-sidebar-links">
          {links.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <Link key={item.to} className={`offline-sidebar-link ${isActive ? 'is-active' : ''}`} to={item.to}>
                <span className="offline-sidebar-icon">{item.short}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className={`offline-workspace offline-workspace-${props.mode} ${isPosFullscreen ? 'offline-pos-fullscreen-mode' : ''}`}>
      {!isPosFullscreen ? (
        <aside className="offline-sidebar">
          <div className="offline-sidebar-brand">
            <div>
              <h1>PharmaERP Offline</h1>
              <p>{auth?.displayName ?? 'Utilisateur local'}</p>
            </div>
            <div className="offline-sidebar-meta">
              <strong>{workstation?.workstationName ?? 'Poste non prepare'}</strong>
              <span>{workstation?.siteName ?? workstation?.siteId ?? 'Site non prepare'}</span>
            </div>
          </div>

          {showSellerAction ? (
            <Link className="offline-sidebar-primary" to="/offline/pos">
              Nouvelle vente
            </Link>
          ) : props.primaryAction ? (
            <div className="offline-sidebar-action">{props.primaryAction}</div>
          ) : null}

          {renderNavSection('POS Offline', sellerLinks)}
          {renderNavSection('Admin Offline', adminLinks)}
        </aside>
      ) : null}

      <main className="offline-workspace-main">
        <header className={`offline-workspace-topbar ${isPosFullscreen ? 'offline-workspace-topbar-pos' : ''}`}>
          <div className={isPosFullscreen ? 'offline-workspace-topbar-main' : ''}>
            {isPosFullscreen && props.exitTo ? (
              <Link className="offline-topbar-exit" to={props.exitTo}>
                ← Quitter le POS
              </Link>
            ) : null}
            <span className="offline-workspace-kicker">{props.mode === 'seller' ? 'POS Offline' : 'Admin Offline'}</span>
            <h2>{props.title}</h2>
            {props.subtitle ? <p>{props.subtitle}</p> : null}
          </div>
          <div className="offline-workspace-topbar-right">
            <div className="offline-topbar-badges">
              <span className={`offline-topbar-badge status-${props.viewModel.networkStatus.toLowerCase()}`}>{networkText}</span>
              <span className="offline-topbar-badge">{syncText}</span>
              <span className="offline-topbar-badge">{cashText}</span>
            </div>
            {props.topActions ? <div className="offline-topbar-actions">{props.topActions}</div> : null}
          </div>
        </header>

        <div className="offline-workspace-content">{props.children}</div>
      </main>
    </section>
  );
}

export function OfflineSellerHeader(props: {
  viewModel: OfflineSnapshotViewModel;
  syncEngine?: ReturnType<typeof useSyncEngine>;
  cashSession?: OfflineCashSessionSnapshot | null;
}) {
  const workstation = props.viewModel.snapshot.workstation;
  const auth = props.viewModel.snapshot.auth;
  const syncEngine = props.syncEngine;
  const networkText = props.viewModel.networkStatus === 'ONLINE'
    ? 'En ligne'
    : props.viewModel.networkStatus === 'DEGRADED'
      ? 'Connexion limitee'
      : 'Hors ligne';
  const syncText = syncEngine?.conflictCount
    ? `${syncEngine.conflictCount} conflit(s)`
    : syncEngine?.pendingCount
      ? `${syncEngine.pendingCount} en attente`
      : 'Synchronise';
  const cashText = canAttachOfflineCashSale(props.cashSession ?? null) ? 'Caisse ouverte' : 'Caisse fermee';

  return (
    <section className="offline-seller-header">
      <div>
        <strong>PharmaERP POS</strong>
        <span>{workstation?.siteName ?? workstation?.siteId ?? 'Site non prepare'}</span>
        <span>{workstation?.workstationName ?? 'Poste non enregistre'}</span>
        <span>{auth?.displayName ?? 'Vendeur'}</span>
      </div>
      <div className="offline-seller-status">
        <span className={`offline-dot offline-dot-${props.viewModel.networkStatus.toLowerCase()}`}>{networkText}</span>
        <span>{syncText}</span>
        <Link to="/offline/cash">{cashText}</Link>
      </div>
    </section>
  );
}

export function OfflineNetworkBanner(props: { viewModel: OfflineSnapshotViewModel; syncEngine?: ReturnType<typeof useSyncEngine> }) {
  if (props.viewModel.networkStatus === 'ONLINE' && !props.syncEngine?.pendingCount && !props.syncEngine?.conflictCount) return null;
  if (props.syncEngine?.conflictCount) {
    return (
      <div className="offline-seller-banner is-warning">
        Une operation necessite la verification d un responsable. <Link to="/offline/synchronisation">Voir details</Link>
      </div>
    );
  }
  if (props.viewModel.networkStatus === 'OFFLINE') {
    return <div className="offline-seller-banner">Mode hors ligne - les ventes seront synchronisees automatiquement.</div>;
  }
  if (props.viewModel.networkStatus === 'DEGRADED') {
    return <div className="offline-seller-banner is-warning">Connexion limitee - vous pouvez continuer a vendre si le poste est autorise.</div>;
  }
  if (props.syncEngine?.pendingCount) {
    return <div className="offline-seller-banner">{props.syncEngine.pendingCount} operation(s) en attente de synchronisation.</div>;
  }
  return null;
}

export function OfflineReceiptTicket(props: {
  sale: OfflineSale | null;
  siteName?: string | null;
  sellerName?: string | null;
  workstationName?: string | null;
}) {
  const sale = props.sale;
  if (!sale) return null;
  const rate = sale.exchangeRateSnapshot ?? null;
  const totalCdf = rate ? Math.round(sale.total * rate) : null;
  const paidUsd = sale.items.length > 0 ? sale.total : 0;

  return (
    <div className="offline-receipt-print">
      <header>
        <h2>PharmaERP POS</h2>
        <p>{props.siteName ?? '-'}</p>
      </header>
      <section>
        <strong>VENTE</strong>
        <p>Reference offline : {sale.offlineReference}</p>
        <p>Reference serveur : {sale.serverSaleNumber ?? 'En attente'}</p>
        <p>Date : {formatDateTime(sale.validatedAt)}</p>
        <p>Vendeur : {props.sellerName ?? '-'}</p>
        <p>Poste : {props.workstationName ?? sale.workstationId}</p>
      </section>
      <table>
        <thead>
          <tr><th>Article</th><th>Qte</th><th>PU</th><th>Total</th></tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.localSaleItemId}>
              <td>{item.articleName}</td>
              <td>{item.quantity}</td>
              <td>{formatMoney(item.unitPriceSnapshot, 'USD')}</td>
              <td>{formatMoney(item.lineTotal, 'USD')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer>
        <p>Total USD : {formatMoney(sale.total, 'USD')}</p>
        <p>Total CDF : {totalCdf !== null ? `${totalCdf.toLocaleString('fr-FR')} FC` : '-'}</p>
        <p>Paye : {formatMoney(paidUsd, 'USD')}</p>
        <p>Statut : {sale.syncStatus === 'SYNCED' ? 'Synchronisee' : 'Vente enregistree hors ligne'}</p>
        {rate ? <p>Taux utilise : 1 USD = {Number(rate).toLocaleString('fr-FR')} FC</p> : null}
      </footer>
    </div>
  );
}

function escapeReceiptHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildOfflineReceiptHtml(params: {
  sale: OfflineSale;
  siteName?: string | null;
  sellerName?: string | null;
  workstationName?: string | null;
}) {
  const { sale } = params;
  const rate = sale.exchangeRateSnapshot ?? null;
  const totalCdf = rate ? Math.round(sale.total * rate) : null;
  const paidUsd = sale.items.length > 0 ? sale.total : 0;
  const rows = sale.items.map((item) => `
    <tr>
      <td>${escapeReceiptHtml(item.articleName)}</td>
      <td>${escapeReceiptHtml(String(item.quantity))}</td>
      <td>${escapeReceiptHtml(formatMoney(item.unitPriceSnapshot, 'USD'))}</td>
      <td>${escapeReceiptHtml(formatMoney(item.lineTotal, 'USD'))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Ticket ${escapeReceiptHtml(sale.offlineReference)}</title>
    <style>
      body {
        color: #111;
        font-family: Arial, sans-serif;
        font-size: 12px;
        line-height: 1.35;
        margin: 0;
        padding: 8px;
        width: 72mm;
      }
      h1 {
        font-size: 16px;
        margin: 0 0 4px;
        text-align: center;
      }
      p {
        margin: 2px 0;
      }
      table {
        border-collapse: collapse;
        margin: 8px 0;
        width: 100%;
      }
      th, td {
        border-bottom: 1px solid #ddd;
        padding: 3px 2px;
        text-align: left;
        vertical-align: top;
      }
      th:nth-child(2),
      th:nth-child(3),
      th:nth-child(4),
      td:nth-child(2),
      td:nth-child(3),
      td:nth-child(4) {
        text-align: right;
      }
      .receipt-block {
        margin-top: 8px;
      }
      .receipt-footer {
        margin-top: 8px;
      }
      @page {
        margin: 6mm;
        size: auto;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>PharmaERP POS</h1>
      <p>${escapeReceiptHtml(params.siteName ?? '-')}</p>
    </header>
    <section class="receipt-block">
      <strong>VENTE</strong>
      <p>Reference offline : ${escapeReceiptHtml(sale.offlineReference)}</p>
      <p>Reference serveur : ${escapeReceiptHtml(sale.serverSaleNumber ?? 'En attente')}</p>
      <p>Date : ${escapeReceiptHtml(formatDateTime(sale.validatedAt))}</p>
      <p>Vendeur : ${escapeReceiptHtml(params.sellerName ?? '-')}</p>
      <p>Poste : ${escapeReceiptHtml(params.workstationName ?? sale.workstationId)}</p>
    </section>
    <table>
      <thead>
        <tr><th>Article</th><th>Qte</th><th>PU</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <footer class="receipt-footer">
      <p>Total USD : ${escapeReceiptHtml(formatMoney(sale.total, 'USD'))}</p>
      <p>Total CDF : ${escapeReceiptHtml(totalCdf !== null ? `${totalCdf.toLocaleString('fr-FR')} FC` : '-')}</p>
      <p>Paye : ${escapeReceiptHtml(formatMoney(paidUsd, 'USD'))}</p>
      <p>Statut : ${escapeReceiptHtml(sale.syncStatus === 'SYNCED' ? 'Synchronisee' : 'Vente enregistree hors ligne')}</p>
      ${rate ? `<p>Taux utilise : 1 USD = ${escapeReceiptHtml(Number(rate).toLocaleString('fr-FR'))} FC</p>` : ''}
    </footer>
  </body>
</html>`;
}

export function printOfflineReceipt(params: {
  sale: OfflineSale | null;
  siteName?: string | null;
  sellerName?: string | null;
  workstationName?: string | null;
}) {
  if (!params.sale) {
    throw new Error('OFFLINE_RECEIPT_MISSING');
  }
  const receiptHtml = buildOfflineReceiptHtml({
    sale: params.sale,
    siteName: params.siteName,
    sellerName: params.sellerName,
    workstationName: params.workstationName,
  });
  const printWindow = window.open('', '_blank', 'width=420,height=720');
  if (!printWindow) {
    throw new Error('PRINT_WINDOW_BLOCKED');
  }
  printWindow.document.open();
  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
