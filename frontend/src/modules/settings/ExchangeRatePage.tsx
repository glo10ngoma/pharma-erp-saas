import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../services/apiError';
import { settingsService } from '../../services/settings.service';
import { formatDate } from '../../utils/date';
import { formatMoney } from '../../utils/money';

export function ExchangeRatePage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canUpdate = permissions.includes('settings.exchange_rate.update');
  const rateQuery = useQuery({ queryKey: ['settings', 'exchange-rate'], queryFn: async () => (await settingsService.getExchangeRate()).data });
  const [rate, setRate] = useState('');
  const [clientError, setClientError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setRate(rateQuery.data?.rate ? String(rateQuery.data.rate) : '');
  }, [rateQuery.data?.rate]);

  const updateRate = useMutation({
    mutationFn: async (nextRate: number) => (await settingsService.updateExchangeRate(nextRate)).data,
    onSuccess: (data) => {
      qc.setQueryData(['settings', 'exchange-rate'], data);
      setRate(data.rate ? String(data.rate) : '');
      setSuccessMessage('Taux USD/CDF enregistre avec succes.');
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage('');
    const normalized = rate.trim().replace(',', '.');
    const nextRate = Number(normalized);
    if (!normalized || !Number.isFinite(nextRate) || nextRate <= 0) {
      setClientError('Veuillez saisir un taux USD/CDF valide.');
      return;
    }
    setClientError('');
    updateRate.mutate(nextRate);
  }

  const currentRate = rateQuery.data?.rate ?? null;
  const error = rateQuery.error || updateRate.error;
  const currentRateLabel = currentRate ? `1 USD = ${formatMoney(currentRate, 'CDF')}` : 'Non configure';

  return (
    <>
      <div className="breadcrumb"><strong>Parametres</strong><span>&gt;</span><strong>Taux de change</strong></div>
      <h1>Taux de change USD/CDF</h1>
      <p className="muted">Taux utilise pour convertir les ventes USD en francs congolais.</p>
      {error && <p className="form-error">{apiErrorMessage(error)}</p>}
      {clientError && <p className="form-error">{clientError}</p>}
      {successMessage && <p className="muted-text">{successMessage}</p>}

      <section className="card compact-card settings-rate-card">
        <span className="kpi-label">Taux de change</span>
        <p className="metric">{currentRateLabel}</p>
        <div className="detail-grid">
          <div><span>Devise de reference</span><strong>{rateQuery.data?.baseCurrency ?? 'USD'}</strong></div>
          <div><span>Devise locale</span><strong>{rateQuery.data?.quoteCurrency ?? 'CDF'}</strong></div>
          <div><span>Statut</span><strong>{currentRate ? 'Configure' : 'Non configure'}</strong></div>
          <div><span>Derniere modification</span><strong>{formatDate(rateQuery.data?.updatedAt)}</strong></div>
          <div><span>Modifie par</span><strong>{rateQuery.data?.updatedBy ?? '-'}</strong></div>
        </div>
      </section>

      <form className="card compact-card form-grid" onSubmit={submit}>
        <label>
          Taux USD vers CDF
          <input
            className="input"
            disabled={!canUpdate || updateRate.isPending}
            min="0.0001"
            onChange={(event) => {
              setRate(event.target.value);
              setClientError('');
              setSuccessMessage('');
            }}
            placeholder="2850"
            required
            step="0.0001"
            type="text"
            inputMode="decimal"
            value={rate}
          />
          <small>1 USD = {rate.trim() ? rate.trim() : '[ valeur ]'} CDF</small>
        </label>
        <p className="muted-text">Ce taux sera utilise par les points de vente lors des paiements en CDF.</p>
        <button className="button" disabled={!canUpdate || updateRate.isPending}>
          {updateRate.isPending ? 'Enregistrement...' : 'Enregistrer le taux'}
        </button>
        {!canUpdate && <p className="muted-text">Permission requise : settings.exchange_rate.update.</p>}
      </form>
    </>
  );
}
