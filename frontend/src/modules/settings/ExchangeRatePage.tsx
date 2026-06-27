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

  useEffect(() => {
    if (rateQuery.data?.rate) setRate(String(rateQuery.data.rate));
  }, [rateQuery.data?.rate]);

  const updateRate = useMutation({
    mutationFn: async () => (await settingsService.updateExchangeRate(Number(rate))).data,
    onSuccess: (data) => {
      qc.setQueryData(['settings', 'exchange-rate'], data);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateRate.mutate();
  }

  const currentRate = Number(rateQuery.data?.rate ?? 2800);
  const error = rateQuery.error || updateRate.error;

  return (
    <>
      <div className="breadcrumb"><strong>Parametres</strong><span>&gt;</span><strong>Taux de change</strong></div>
      <h1>Taux de change USD/CDF</h1>
      {error && <p className="form-error">{apiErrorMessage(error)}</p>}

      <section className="card compact-card settings-rate-card">
        <span className="kpi-label">Taux courant</span>
        <p className="metric">1 USD = {formatMoney(currentRate, 'CDF')}</p>
        <div className="detail-grid">
          <div><span>Devise de base</span><strong>{rateQuery.data?.baseCurrency ?? 'USD'}</strong></div>
          <div><span>Devise quote</span><strong>{rateQuery.data?.quoteCurrency ?? 'CDF'}</strong></div>
          <div><span>Derniere modification</span><strong>{formatDate(rateQuery.data?.updatedAt)}</strong></div>
          <div><span>Modifie par</span><strong>{rateQuery.data?.updatedBy ?? '-'}</strong></div>
        </div>
      </section>

      <form className="card compact-card form-grid" onSubmit={submit}>
        <label>
          Nouveau taux
          <input
            className="input"
            disabled={!canUpdate || updateRate.isPending}
            min="0.0001"
            onChange={(event) => setRate(event.target.value)}
            placeholder="2850"
            required
            step="0.0001"
            type="number"
            value={rate}
          />
        </label>
        <button className="button" disabled={!canUpdate || updateRate.isPending || Number(rate) <= 0}>
          {updateRate.isPending ? 'Enregistrement...' : 'Modifier le taux'}
        </button>
        {!canUpdate && <p className="muted-text">Permission requise : settings.exchange_rate.update.</p>}
      </form>
    </>
  );
}
