import { buildOfflineReceiptHtml } from './offline-ui';
import { type OfflineSale } from './offline-types';

export type PosPrinterMode = 'BROWSER' | 'DIRECT';

export type PosPrinterConfiguration = {
  mode: PosPrinterMode;
  printerName: string;
  paperWidthMm: 58 | 80;
  autoPrint: boolean;
  copies: number;
  agentUrl: string;
};

export type PosPrinterStatus = {
  status: 'READY' | 'NOT_CONFIGURED' | 'UNAVAILABLE';
  message: string;
};

export type PosPrinterResult = {
  success: boolean;
  skipped?: boolean;
  message: string;
};

type PosPrinterTicket = {
  workstationId: string;
  sale: OfflineSale;
  siteName?: string | null;
  sellerName?: string | null;
  workstationName?: string | null;
};

const PRINTER_CONFIG_PREFIX = 'pharmaerp:offline-printer:';

const DEFAULT_CONFIGURATION: PosPrinterConfiguration = {
  mode: 'BROWSER',
  printerName: '',
  paperWidthMm: 80,
  autoPrint: true,
  copies: 1,
  agentUrl: '',
};

export const posPrinterService = {
  getConfiguration(workstationId: string | null | undefined): PosPrinterConfiguration {
    if (!workstationId || typeof window === 'undefined') return { ...DEFAULT_CONFIGURATION };
    try {
      const raw = window.localStorage.getItem(`${PRINTER_CONFIG_PREFIX}${workstationId}`);
      if (!raw) return { ...DEFAULT_CONFIGURATION };
      return normalizeConfiguration(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_CONFIGURATION };
    }
  },

  saveConfiguration(workstationId: string, updates: Partial<PosPrinterConfiguration>) {
    const next = normalizeConfiguration({ ...this.getConfiguration(workstationId), ...updates });
    window.localStorage.setItem(`${PRINTER_CONFIG_PREFIX}${workstationId}`, JSON.stringify(next));
    return next;
  },

  async getPrinterStatus(workstationId: string | null | undefined): Promise<PosPrinterStatus> {
    const configuration = this.getConfiguration(workstationId);
    if (configuration.mode === 'BROWSER') {
      return { status: 'READY', message: 'Dialogue d impression du navigateur actif.' };
    }
    const agentUrl = getLocalAgentUrl(configuration.agentUrl);
    if (!agentUrl || !configuration.printerName.trim()) {
      return { status: 'NOT_CONFIGURED', message: 'Impression directe a configurer sur ce poste.' };
    }

    try {
      const response = await fetch(`${agentUrl}/status`, { signal: AbortSignal.timeout(1500) });
      if (!response.ok) throw new Error('PRINT_AGENT_UNAVAILABLE');
      return { status: 'READY', message: `Agent local pret pour ${configuration.printerName}.` };
    } catch {
      return { status: 'UNAVAILABLE', message: 'Agent d impression local indisponible.' };
    }
  },

  async printTicket(ticket: PosPrinterTicket, options?: { automatic?: boolean }): Promise<PosPrinterResult> {
    const configuration = this.getConfiguration(ticket.workstationId);
    if (options?.automatic && !configuration.autoPrint) {
      return { success: true, skipped: true, message: 'Impression automatique desactivee pour ce poste.' };
    }

    if (configuration.mode === 'BROWSER') {
      return printWithBrowser(ticket);
    }

    const agentUrl = getLocalAgentUrl(configuration.agentUrl);
    if (!agentUrl || !configuration.printerName.trim()) {
      return { success: false, message: 'Impression directe non configuree sur ce poste.' };
    }

    try {
      const response = await fetch(`${agentUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: configuration.printerName,
          paperWidthMm: configuration.paperWidthMm,
          copies: configuration.copies,
          ticket: {
            offlineReference: ticket.sale.offlineReference,
            validatedAt: ticket.sale.validatedAt,
            html: buildOfflineReceiptHtml(ticket),
          },
        }),
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error('PRINT_AGENT_FAILED');
      return { success: true, message: 'Ticket envoye a l imprimante configuree.' };
    } catch {
      return { success: false, message: 'Ticket non imprime - Reessayer.' };
    }
  },
};

function normalizeConfiguration(value: Partial<PosPrinterConfiguration>): PosPrinterConfiguration {
  return {
    mode: value.mode === 'DIRECT' ? 'DIRECT' : 'BROWSER',
    printerName: String(value.printerName ?? ''),
    paperWidthMm: value.paperWidthMm === 58 ? 58 : 80,
    autoPrint: value.autoPrint !== false,
    copies: Math.min(5, Math.max(1, Math.round(Number(value.copies) || 1))),
    agentUrl: String(value.agentUrl ?? '').trim(),
  };
}

function getLocalAgentUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    return url.protocol === 'http:' && isLoopback ? url.origin : null;
  } catch {
    return null;
  }
}

function printWithBrowser(ticket: PosPrinterTicket): PosPrinterResult {
  const printWindow = window.open('', '_blank', 'width=420,height=720');
  if (!printWindow) return { success: false, message: 'Ticket non imprime - Reessayer.' };

  printWindow.document.open();
  printWindow.document.write(buildOfflineReceiptHtml(ticket));
  printWindow.document.close();
  printWindow.focus();
  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
  printWindow.print();
  return { success: true, message: 'Dialogue d impression ouvert.' };
}
