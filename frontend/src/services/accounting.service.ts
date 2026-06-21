import { apiClient } from './apiClient';

export type Account = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  isActive: boolean;
};

export type Journal = {
  journalId: string;
  journalCode: string;
  journalName: string;
  journalType: string;
  isActive: boolean;
};

export type EntryLine = {
  entryLineId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string | null;
};

export type Entry = {
  entryId: string;
  journalCode: string;
  entryNumber: string;
  entryDate: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  totalDebit: number;
  totalCredit: number;
  status: string;
  lines?: EntryLine[];
};

export type LedgerLine = {
  accountCode: string;
  accountName: string;
  entryDate: string;
  entryNumber: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  debit: number;
  credit: number;
};

export type TrialBalanceLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

export const accountingService = {
  getAccounts: () => apiClient.get<Account[]>('/accounting/accounts'),
  createAccount: (payload: Record<string, unknown>) => apiClient.post<Account>('/accounting/accounts', payload),
  getJournals: () => apiClient.get<Journal[]>('/accounting/journals'),
  createJournal: (payload: Record<string, unknown>) => apiClient.post<Journal>('/accounting/journals', payload),
  getEntries: () => apiClient.get<Entry[]>('/accounting/entries'),
  postEntry: (id: string) => apiClient.post<Entry>(`/accounting/entries/${id}/post`),
  getTrialBalance: () => apiClient.get<TrialBalanceLine[]>('/accounting/trial-balance'),
  getGeneralLedger: (accountCode?: string) => apiClient.get<LedgerLine[]>('/accounting/general-ledger', { params: accountCode ? { accountCode } : undefined }),
};
