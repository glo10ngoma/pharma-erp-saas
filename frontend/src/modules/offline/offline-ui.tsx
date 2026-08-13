import { Link, useLocation } from 'react-router-dom';
import { formatDateTime } from '../../utils/date';
import { formatMoney } from '../../utils/money';
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
  const cashText = props.cashSession ? 'Caisse ouverte' : 'Caisse fermee';

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
