import { buildOfflineReceiptHtml, buildOfflineReceiptText } from './offline-ui';
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

export type PosPrinterDevice = {
  name: string;
  isDefault: boolean;
};

export type PosPrinterListResult = {
  printers: PosPrinterDevice[];
  error?: string;
};

type PosPrinterTicket = {
  workstationId: string;
  sale: OfflineSale;
  siteName?: string | null;
  sellerName?: string | null;
  workstationName?: string | null;
};

const PRINTER_CONFIG_PREFIX = 'pharmaerp:offline-printer:';
const DEFAULT_AGENT_URL = 'http://127.0.0.1:17373';

const DEFAULT_CONFIGURATION: PosPrinterConfiguration = {
  mode: 'DIRECT',
  printerName: '',
  paperWidthMm: 80,
  autoPrint: true,
  copies: 1,
  agentUrl: DEFAULT_AGENT_URL,
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
    const agentUrl = getLocalAgentUrl(configuration.agentUrl);
    if (!agentUrl) {
      return { status: 'UNAVAILABLE', message: 'Service d impression locale indisponible.' };
    }

    try {
      const response = await fetch(`${agentUrl}/health`, { signal: AbortSignal.timeout(1500) });
      if (!response.ok) throw new Error('PRINT_AGENT_UNAVAILABLE');
      if (!configuration.printerName.trim()) {
        return { status: 'NOT_CONFIGURED', message: 'Service d impression connecte. Selectionnez une imprimante.' };
      }
      return { status: 'READY', message: `Agent local pret pour ${configuration.printerName}.` };
    } catch {
      return { status: 'UNAVAILABLE', message: 'Service d impression locale indisponible.' };
    }
  },

  async listPrinters(workstationId: string | null | undefined): Promise<PosPrinterDevice[]> {
    return (await this.listPrintersWithResult(workstationId)).printers;
  },

  async listPrintersWithResult(workstationId: string | null | undefined): Promise<PosPrinterListResult> {
    const configuration = this.getConfiguration(workstationId);
    const agentUrl = getLocalAgentUrl(configuration.agentUrl);
    if (!agentUrl) return { printers: [], error: 'URL agent local invalide.' };
    try {
      const response = await fetch(`${agentUrl}/printers`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.printers)) {
        return { printers: [], error: 'Format de reponse /printers inattendu.' };
      }
      const printers = payload.printers
        .map((row: unknown) => normalizePrinterDevice(row))
        .filter((row: PosPrinterDevice | null): row is PosPrinterDevice => Boolean(row));
      return { printers };
    } catch (error) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? 'delai depasse'
        : error instanceof Error && error.message
          ? error.message
          : 'erreur inconnue';
      return { printers: [], error: message };
    }
  },

  async printTicket(ticket: PosPrinterTicket, options?: { automatic?: boolean }): Promise<PosPrinterResult> {
    const configuration = this.getConfiguration(ticket.workstationId);
    if (options?.automatic && !configuration.autoPrint) {
      return { success: true, skipped: true, message: 'Impression automatique desactivee pour ce poste.' };
    }

    if (configuration.mode === 'BROWSER') {
      return { success: false, message: 'Service d impression locale indisponible.' };
    }

    const agentUrl = getLocalAgentUrl(configuration.agentUrl);
    if (!agentUrl || !configuration.printerName.trim()) {
      return { success: false, message: 'Service d impression locale indisponible.' };
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
            text: buildOfflineReceiptText(ticket),
          },
        }),
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error('PRINT_AGENT_FAILED');
      return { success: true, message: 'Ticket envoye a l imprimante configuree.' };
    } catch {
      return { success: false, message: 'Service d impression locale indisponible.' };
    }
  },

  printBrowserTicket(ticket: PosPrinterTicket): PosPrinterResult {
    return printWithBrowser(ticket);
  },

  async printTest(workstationId: string): Promise<PosPrinterResult> {
    const configuration = this.getConfiguration(workstationId);
    const agentUrl = getLocalAgentUrl(configuration.agentUrl);
    if (!agentUrl) {
      return { success: false, message: 'Service d impression locale indisponible.' };
    }
    if (!configuration.printerName.trim()) return { success: false, message: 'Selectionnez une imprimante.' };
    try {
      const response = await fetch(`${agentUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: configuration.printerName,
          paperWidthMm: configuration.paperWidthMm,
          copies: configuration.copies,
          ticket: {
            offlineReference: 'TEST-PRINT',
            validatedAt: new Date().toISOString(),
            text: [
              '--------------------------------',
              'PharmaERP',
              '',
              'TEST IMPRESSION',
              '',
              'Poste :',
              workstationId,
              '',
              'Imprimante :',
              configuration.printerName,
              '',
              'Print Agent : OK',
              '--------------------------------',
            ].join('\n'),
          },
        }),
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Impression refusee par Windows ou le Print Agent.');
      }
      return { success: true, message: `Ticket test envoye a ${configuration.printerName}.` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error && error.message ? error.message : 'Service d impression locale indisponible.',
      };
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
    agentUrl: String(value.agentUrl ?? DEFAULT_AGENT_URL).trim() || DEFAULT_AGENT_URL,
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

function normalizePrinterDevice(value: unknown): PosPrinterDevice | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { name?: unknown; isDefault?: unknown; default?: unknown };
  const name = String(row.name ?? '').trim();
  if (!name) return null;
  return { name, isDefault: row.isDefault === true || row.default === true };
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
