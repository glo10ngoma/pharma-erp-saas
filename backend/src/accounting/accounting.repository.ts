import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalDto } from './dto/create-journal.dto';

type Queryable = { query: <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };
type AccountRow = { account_id: string; tenant_id: string | null; account_code: string; account_name: string; account_type: string; parent_account_id: string | null; is_active: boolean; created_at: Date };
type JournalRow = { journal_id: string; tenant_id: string | null; journal_code: string; journal_name: string; journal_type: string; is_active: boolean };
type EntryRow = { entry_id: string; tenant_id: string; journal_id: string; journal_code: string | null; entry_number: string; entry_date: string; reference_type: string | null; reference_id: string | null; description: string | null; total_debit: string; total_credit: string; status: string; created_by: string | null; posted_by: string | null; created_at: Date; posted_at: Date | null };
type EntryLine = { accountCode: string; debit?: number; credit?: number; description?: string };

@Injectable()
export class AccountingRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAccounts(user: AuthUser) { await this.ensureDefaults(this.db as unknown as Queryable, user.tenantId); const r = await this.db.query<AccountRow>(`SELECT account_id, tenant_id, account_code, account_name, account_type, parent_account_id, is_active, created_at FROM chart_of_accounts WHERE tenant_id=$1 ORDER BY account_code`, [user.tenantId]); return r.rows.map(this.toAccount); }
  async createAccount(user: AuthUser, dto: CreateAccountDto) { const r = await this.db.query<AccountRow>(`INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, parent_account_id, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING account_id, tenant_id, account_code, account_name, account_type, parent_account_id, is_active, created_at`, [user.tenantId, dto.accountCode, dto.accountName, dto.accountType, dto.parentAccountId ?? null, dto.isActive ?? true]); return this.toAccount(r.rows[0]); }
  async findJournals(user: AuthUser) { await this.ensureDefaults(this.db as unknown as Queryable, user.tenantId); const r = await this.db.query<JournalRow>(`SELECT journal_id, tenant_id, journal_code, journal_name, journal_type, is_active FROM accounting_journals WHERE tenant_id=$1 ORDER BY journal_code`, [user.tenantId]); return r.rows.map(this.toJournal); }
  async createJournal(user: AuthUser, dto: CreateJournalDto) { const r = await this.db.query<JournalRow>(`INSERT INTO accounting_journals (tenant_id, journal_code, journal_name, journal_type, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING journal_id, tenant_id, journal_code, journal_name, journal_type, is_active`, [user.tenantId, dto.journalCode, dto.journalName, dto.journalType, dto.isActive ?? true]); return this.toJournal(r.rows[0]); }
  async findEntries(user: AuthUser) { const r = await this.db.query<EntryRow>(this.entriesSql(`WHERE je.tenant_id=$1 ORDER BY je.entry_date DESC, je.created_at DESC LIMIT 200`), [user.tenantId]); return Promise.all(r.rows.map((row) => this.toEntryWithLines(user, row))); }
  async findEntry(user: AuthUser, id: string) { const r = await this.db.query<EntryRow>(this.entriesSql(`WHERE je.tenant_id=$1 AND je.entry_id=$2 LIMIT 1`), [user.tenantId, id]); return r.rows[0] ? this.toEntryWithLines(user, r.rows[0]) : null; }
  async postEntry(user: AuthUser, id: string) { const r = await this.db.query<EntryRow>(`UPDATE journal_entries SET status='POSTED', posted_by=$3, posted_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND entry_id=$2 AND status='DRAFT' RETURNING entry_id, tenant_id, journal_id, NULL::text AS journal_code, entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit, status, created_by, posted_by, created_at, posted_at`, [user.tenantId, id, user.userId]); return r.rows[0] ? this.findEntry(user, id) : null; }

  async trialBalance(user: AuthUser) {
    await this.ensureDefaults(this.db as unknown as Queryable, user.tenantId);
    const r = await this.db.query(
      `SELECT coa.account_code AS "accountCode", coa.account_name AS "accountName",
              COALESCE(SUM(CASE WHEN je.status='POSTED' THEN jel.debit ELSE 0 END),0)::numeric AS debit,
              COALESCE(SUM(CASE WHEN je.status='POSTED' THEN jel.credit ELSE 0 END),0)::numeric AS credit
       FROM chart_of_accounts coa
       LEFT JOIN journal_entry_lines jel ON jel.account_id=coa.account_id AND jel.tenant_id=coa.tenant_id
       LEFT JOIN journal_entries je ON je.entry_id=jel.entry_id AND je.tenant_id=jel.tenant_id
       WHERE coa.tenant_id=$1
       GROUP BY coa.account_code, coa.account_name
       ORDER BY coa.account_code`,
      [user.tenantId],
    );
    return r.rows.map((row: any) => ({ ...row, debit: Number(row.debit), credit: Number(row.credit) }));
  }

  async generalLedger(user: AuthUser, accountCode?: string) {
    await this.ensureDefaults(this.db as unknown as Queryable, user.tenantId);
    const params: unknown[] = [user.tenantId];
    let filter = '';
    if (accountCode) { params.push(accountCode); filter = `AND coa.account_code=$${params.length}`; }
    const r = await this.db.query(
      `SELECT coa.account_code AS "accountCode", coa.account_name AS "accountName", je.entry_date AS "entryDate",
              je.entry_number AS "entryNumber", je.reference_type AS "referenceType", je.reference_id AS "referenceId",
              jel.description, jel.debit::numeric AS debit, jel.credit::numeric AS credit
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.entry_id=jel.entry_id AND je.tenant_id=jel.tenant_id
       JOIN chart_of_accounts coa ON coa.account_id=jel.account_id AND coa.tenant_id=jel.tenant_id
       WHERE jel.tenant_id=$1 AND je.status='POSTED' ${filter}
       ORDER BY coa.account_code, je.entry_date, je.created_at`,
      params,
    );
    return r.rows.map((row: any) => ({ ...row, debit: Number(row.debit), credit: Number(row.credit) }));
  }

  async createAutomaticEntry(client: Queryable, user: AuthUser, input: { journalCode: string; referenceType: string; referenceId: string; description: string; lines: EntryLine[] }) {
    await this.ensureDefaults(client, user.tenantId);
    const existing = await client.query<{ entry_id: string }>(`SELECT entry_id FROM journal_entries WHERE tenant_id=$1 AND reference_type=$2 AND reference_id=$3 AND status='POSTED' LIMIT 1`, [user.tenantId, input.referenceType, input.referenceId]);
    if (existing.rows[0]) return existing.rows[0].entry_id;
    const totalDebit = this.round(input.lines.reduce((s, l) => s + (l.debit ?? 0), 0));
    const totalCredit = this.round(input.lines.reduce((s, l) => s + (l.credit ?? 0), 0));
    if (totalDebit <= 0 || totalDebit !== totalCredit) throw new Error('ACCOUNTING_ENTRY_NOT_BALANCED');
    const journal = await client.query<{ journal_id: string }>(`SELECT journal_id FROM accounting_journals WHERE tenant_id=$1 AND journal_code=$2 AND is_active=true LIMIT 1`, [user.tenantId, input.journalCode]);
    if (!journal.rows[0]) throw new Error('ACCOUNTING_JOURNAL_NOT_FOUND');
    const entryNumber = `${input.journalCode}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const entry = await client.query<{ entry_id: string }>(
      `INSERT INTO journal_entries (tenant_id, journal_id, entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit, status, created_by, posted_by, posted_at)
       VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8,'POSTED',$9,$9,CURRENT_TIMESTAMP)
       RETURNING entry_id`,
      [user.tenantId, journal.rows[0].journal_id, entryNumber, input.referenceType, input.referenceId, input.description, totalDebit, totalCredit, user.userId],
    );
    for (const line of input.lines.filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0)) {
      const account = await client.query<{ account_id: string }>(`SELECT account_id FROM chart_of_accounts WHERE tenant_id=$1 AND account_code=$2 AND is_active=true LIMIT 1`, [user.tenantId, line.accountCode]);
      if (!account.rows[0]) throw new Error('ACCOUNTING_ACCOUNT_NOT_FOUND');
      await client.query(`INSERT INTO journal_entry_lines (tenant_id, entry_id, account_id, debit, credit, description) VALUES ($1,$2,$3,$4,$5,$6)`, [user.tenantId, entry.rows[0].entry_id, account.rows[0].account_id, line.debit ?? 0, line.credit ?? 0, line.description ?? input.description]);
    }
    return entry.rows[0].entry_id;
  }

  async ensureDefaults(client: Queryable, tenantId: string) {
    await client.query(`INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, parent_account_id, is_active) SELECT $1, account_code, account_name, account_type, NULL, is_active FROM chart_of_accounts WHERE tenant_id IS NULL ON CONFLICT (tenant_id, account_code) DO NOTHING`, [tenantId]);
    await client.query(`INSERT INTO accounting_journals (tenant_id, journal_code, journal_name, journal_type, is_active) SELECT $1, journal_code, journal_name, journal_type, is_active FROM accounting_journals WHERE tenant_id IS NULL ON CONFLICT (tenant_id, journal_code) DO NOTHING`, [tenantId]);
  }

  private async toEntryWithLines(user: AuthUser, row: EntryRow) {
    const lines = await this.db.query(`SELECT jel.entry_line_id AS "entryLineId", coa.account_code AS "accountCode", coa.account_name AS "accountName", jel.debit::numeric AS debit, jel.credit::numeric AS credit, jel.description FROM journal_entry_lines jel JOIN chart_of_accounts coa ON coa.account_id=jel.account_id AND coa.tenant_id=jel.tenant_id WHERE jel.tenant_id=$1 AND jel.entry_id=$2 ORDER BY coa.account_code`, [user.tenantId, row.entry_id]);
    return { ...this.toEntry(row), lines: lines.rows.map((line: any) => ({ ...line, debit: Number(line.debit), credit: Number(line.credit) })) };
  }
  private entriesSql(where: string) { return `SELECT je.entry_id, je.tenant_id, je.journal_id, aj.journal_code, je.entry_number, je.entry_date, je.reference_type, je.reference_id, je.description, je.total_debit, je.total_credit, je.status, je.created_by, je.posted_by, je.created_at, je.posted_at FROM journal_entries je JOIN accounting_journals aj ON aj.journal_id=je.journal_id AND aj.tenant_id=je.tenant_id ${where}`; }
  private round(value: number) { return Math.round(value * 100) / 100; }
  private toAccount(row: AccountRow) { return { accountId: row.account_id, tenantId: row.tenant_id, accountCode: row.account_code, accountName: row.account_name, accountType: row.account_type, parentAccountId: row.parent_account_id, isActive: row.is_active, createdAt: row.created_at }; }
  private toJournal(row: JournalRow) { return { journalId: row.journal_id, tenantId: row.tenant_id, journalCode: row.journal_code, journalName: row.journal_name, journalType: row.journal_type, isActive: row.is_active }; }
  private toEntry(row: EntryRow) { return { entryId: row.entry_id, tenantId: row.tenant_id, journalId: row.journal_id, journalCode: row.journal_code, entryNumber: row.entry_number, entryDate: row.entry_date, referenceType: row.reference_type, referenceId: row.reference_id, description: row.description, totalDebit: Number(row.total_debit), totalCredit: Number(row.total_credit), status: row.status, createdBy: row.created_by, postedBy: row.posted_by, createdAt: row.created_at, postedAt: row.posted_at }; }
}
