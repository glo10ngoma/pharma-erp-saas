import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AccountingRepository } from '../accounting/accounting.repository';
import { DatabaseService } from '../database/database.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashExpenseDto } from './dto/create-cash-expense.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

type Queryable = {
  query: <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

type CashSessionRow = {
  cash_session_id: string;
  tenant_id: string;
  site_id: string;
  site_name: string | null;
  user_id: string;
  user_name: string | null;
  cash_register_id: string | null;
  register_name: string | null;
  register_currency_code: string | null;
  workstation_id: string | null;
  workstation_name: string | null;
  opened_at: Date;
  closed_at: Date | null;
  opening_balance: string;
  closing_balance: string | null;
  expected_closing_balance: string;
  difference_amount: string;
  opened_ip_address: string | null;
  closed_ip_address: string | null;
  device_uuid: string | null;
  counted_closing_balance_usd: string | null;
  counted_closing_balance_cdf: string | null;
  expected_closing_balance_usd: string | null;
  expected_closing_balance_cdf: string | null;
  closing_difference_usd: string | null;
  closing_difference_cdf: string | null;
  status: string;
  notes: string | null;
};

type CashMovementRow = {
  cash_movement_id: string;
  tenant_id: string;
  cash_session_id: string;
  movement_date: Date;
  movement_type: string;
  amount: string;
  currency_id: string;
  currency_code: string | null;
  currency_symbol: string | null;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_by: string | null;
};

@Injectable()
export class CashRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly accounting: AccountingRepository,
  ) {}

  async findSessions(user: AuthUser) {
    const result = await this.db.query<CashSessionRow>(
      `
      SELECT cs.cash_session_id, cs.tenant_id, cs.site_id, s.site_name, cs.user_id,
             u.full_name AS user_name, cs.cash_register_id, cr.register_name,
             cur.currency_code AS register_currency_code,
             cs.workstation_id, cs.workstation_name,
             cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
             cs.expected_closing_balance, cs.difference_amount,
             cs.opened_ip_address, cs.closed_ip_address, cs.device_uuid,
             cs.counted_closing_balance_usd, cs.counted_closing_balance_cdf,
             cs.expected_closing_balance_usd, cs.expected_closing_balance_cdf,
             cs.closing_difference_usd, cs.closing_difference_cdf,
             cs.status, cs.notes
      FROM cash_sessions cs
      JOIN sites s ON s.site_id = cs.site_id AND s.tenant_id = cs.tenant_id
      LEFT JOIN users u ON u.user_id = cs.user_id AND u.tenant_id = cs.tenant_id
      LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
      LEFT JOIN currencies cur ON cur.currency_id = cr.currency_id
      WHERE cs.tenant_id = $1
        AND ($2::uuid IS NULL OR cs.site_id = $2::uuid)
      ORDER BY cs.opened_at DESC
      `,
      [user.tenantId, user.siteId ?? null],
    );
    return result.rows.map(this.toSession);
  }

  async currentSession(user: AuthUser, siteId?: string, deviceUuid?: string) {
    if (siteId) await this.assertSiteAllowed(user, siteId);
    const result = await this.db.query<CashSessionRow>(
      `
      SELECT cs.cash_session_id, cs.tenant_id, cs.site_id, s.site_name, cs.user_id,
             u.full_name AS user_name, cs.cash_register_id, cr.register_name,
             cur.currency_code AS register_currency_code,
             cs.workstation_id, cs.workstation_name,
             cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
             cs.expected_closing_balance, cs.difference_amount,
             cs.opened_ip_address, cs.closed_ip_address, cs.device_uuid,
             cs.counted_closing_balance_usd, cs.counted_closing_balance_cdf,
             cs.expected_closing_balance_usd, cs.expected_closing_balance_cdf,
             cs.closing_difference_usd, cs.closing_difference_cdf,
             cs.status, cs.notes
      FROM cash_sessions cs
      JOIN sites s ON s.site_id = cs.site_id AND s.tenant_id = cs.tenant_id
      LEFT JOIN users u ON u.user_id = cs.user_id AND u.tenant_id = cs.tenant_id
      LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
      LEFT JOIN currencies cur ON cur.currency_id = cr.currency_id
      WHERE cs.tenant_id = $1
        AND cs.user_id = $2
        AND cs.status = 'OPEN'
        AND ($3::uuid IS NULL OR cs.site_id = $3::uuid)
        AND ($4::uuid IS NULL OR cs.site_id = $4::uuid)
        AND ($5::text IS NULL OR cs.device_uuid = $5::text)
      ORDER BY cs.opened_at DESC
      LIMIT 1
      `,
      [user.tenantId, user.userId, siteId ?? null, user.siteId ?? null, deviceUuid ?? null],
    );
    return result.rows[0] ? this.toSession(result.rows[0]) : null;
  }

  async openSession(user: AuthUser, dto: OpenCashSessionDto, ipAddress?: string) {
    await this.assertSiteAllowed(user, dto.siteId);
    if (dto.cashRegisterId) await this.assertCashRegister(user, dto.siteId, dto.cashRegisterId);
    const workstation = dto.workstationId ? await this.assertWorkstation(user, dto.siteId, dto.workstationId) : null;

    return this.db.transaction(async (client) => {
      if (!user.permissions.includes('sessions.multiple')) {
        const existing = await client.query<{ total: string }>(
          `
          SELECT COUNT(*)::int AS total
          FROM cash_sessions
          WHERE tenant_id = $1 AND site_id = $2 AND user_id = $3 AND status = 'OPEN'
          `,
          [user.tenantId, dto.siteId, user.userId],
        );
        if (Number(existing.rows[0]?.total ?? 0) > 0) throw new ConflictException('CASH_SESSION_ALREADY_OPEN');
      }

      if (dto.workstationId) {
        const existingWorkstation = await client.query<{ total: string }>(
          `
          SELECT COUNT(*)::int AS total
          FROM cash_sessions
          WHERE tenant_id = $1 AND site_id = $2 AND workstation_id = $3 AND status = 'OPEN'
          `,
          [user.tenantId, dto.siteId, dto.workstationId],
        );
        if (Number(existingWorkstation.rows[0]?.total ?? 0) > 0) {
          throw new ConflictException('WORKSTATION_SESSION_ALREADY_OPEN');
        }
      }

      const created = await client.query<{ cash_session_id: string }>(
        `
        INSERT INTO cash_sessions (
          tenant_id, site_id, user_id, cash_register_id, workstation_id, workstation_name,
          opening_balance, status, notes, opened_ip_address, device_uuid
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, $10)
        RETURNING cash_session_id
        `,
        [
          user.tenantId,
          dto.siteId,
          user.userId,
          dto.cashRegisterId ?? null,
          dto.workstationId ?? null,
          workstation?.workstation_name ?? null,
          dto.openingBalance,
          dto.notes ?? null,
          ipAddress ?? null,
          dto.deviceUuid ?? null,
        ],
      );

      await client.query(
        `
        INSERT INTO audit_logs (
          tenant_id, site_id, user_id, table_name, record_id, action_type, new_value, workstation_id, workstation_name, cash_session_id, ip_address
        )
        VALUES ($1, $2, $3, 'cash_sessions', $4, 'INSERT', $5::jsonb, $6, $7, $4, $8)
        `,
        [
          user.tenantId,
          dto.siteId,
          user.userId,
          created.rows[0].cash_session_id,
          JSON.stringify({
            status: 'OPEN',
            openingBalance: dto.openingBalance,
            workstationId: dto.workstationId ?? null,
            workstationName: workstation?.workstation_name ?? null,
          }),
          dto.workstationId ?? null,
          workstation?.workstation_name ?? null,
          ipAddress ?? null,
        ],
      );

      return created.rows[0].cash_session_id;
    }).then((id) => this.findSessionById(user, id));
  }

  async closeSession(user: AuthUser, id: string, dto: CloseCashSessionDto, ipAddress?: string) {
    await this.db.transaction(async (client) => {
      const locked = await client.query<CashSessionRow>(
        `
        SELECT cs.cash_session_id, cs.tenant_id, cs.site_id, NULL::text AS site_name, cs.user_id,
               NULL::text AS user_name, cs.cash_register_id, NULL::text AS register_name,
               cur.currency_code AS register_currency_code,
               cs.workstation_id, cs.workstation_name,
               cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
               cs.expected_closing_balance, cs.difference_amount,
               cs.opened_ip_address, cs.closed_ip_address, cs.device_uuid,
               cs.counted_closing_balance_usd, cs.counted_closing_balance_cdf,
               cs.expected_closing_balance_usd, cs.expected_closing_balance_cdf,
               cs.closing_difference_usd, cs.closing_difference_cdf,
               cs.status, cs.notes
        FROM cash_sessions cs
        LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
        LEFT JOIN currencies cur ON cur.currency_id = cr.currency_id
        WHERE cs.tenant_id = $1 AND cs.cash_session_id = $2
          AND ($3::uuid IS NULL OR cs.site_id = $3::uuid)
        FOR UPDATE OF cs
        `,
        [user.tenantId, id, user.siteId ?? null],
      );
      const session = locked.rows[0];
      if (!session) throw new NotFoundException('CASH_SESSION_NOT_FOUND');
      if (session.status !== 'OPEN') throw new BadRequestException('CASH_SESSION_NOT_OPEN');

      const totals = await client.query<{
        total_cash_in_usd: string;
        total_cash_out_usd: string;
        total_cash_in_cdf: string;
        total_cash_out_cdf: string;
      }>(
        `
        SELECT
          COALESCE(SUM(CASE WHEN movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT') AND cur.currency_code = 'USD' THEN amount ELSE 0 END),0)::numeric AS total_cash_in_usd,
          COALESCE(SUM(CASE WHEN movement_type IN ('SALE_CHANGE','EXPENSE','CASH_OUT','BANK_DEPOSIT') AND cur.currency_code = 'USD' THEN amount ELSE 0 END),0)::numeric AS total_cash_out_usd,
          COALESCE(SUM(CASE WHEN movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT') AND cur.currency_code = 'CDF' THEN amount ELSE 0 END),0)::numeric AS total_cash_in_cdf,
          COALESCE(SUM(CASE WHEN movement_type IN ('SALE_CHANGE','EXPENSE','CASH_OUT','BANK_DEPOSIT') AND cur.currency_code = 'CDF' THEN amount ELSE 0 END),0)::numeric AS total_cash_out_cdf
        FROM cash_movements cm
        LEFT JOIN currencies cur ON cur.currency_id = cm.currency_id
        WHERE tenant_id = $1 AND cash_session_id = $2
        `,
        [user.tenantId, id],
      );

      const openingBalances = this.openingBalancesByCurrency(session.opening_balance, session.register_currency_code);
      const totalInUsd = Number(totals.rows[0]?.total_cash_in_usd ?? 0);
      const totalOutUsd = Number(totals.rows[0]?.total_cash_out_usd ?? 0);
      const totalInCdf = Number(totals.rows[0]?.total_cash_in_cdf ?? 0);
      const totalOutCdf = Number(totals.rows[0]?.total_cash_out_cdf ?? 0);
      const expectedUsd = this.roundMoney(openingBalances.usd + totalInUsd - totalOutUsd);
      const expectedCdf = this.roundMoney(openingBalances.cdf + totalInCdf - totalOutCdf);
      const countedBalances = this.countedBalancesByCurrency(dto, session.register_currency_code);
      const differenceUsd = this.roundMoney(countedBalances.usd - expectedUsd);
      const differenceCdf = this.roundMoney(countedBalances.cdf - expectedCdf);
      const primaryCurrency = session.register_currency_code === 'CDF' ? 'CDF' : 'USD';
      const legacyExpected = primaryCurrency === 'CDF' ? expectedCdf : expectedUsd;
      const legacyCounted = primaryCurrency === 'CDF' ? countedBalances.cdf : countedBalances.usd;
      const legacyDifference = primaryCurrency === 'CDF' ? differenceCdf : differenceUsd;

      await client.query(
        `
        UPDATE cash_sessions
        SET status = 'CLOSED',
            closed_at = CURRENT_TIMESTAMP,
            closing_balance = $3,
            expected_closing_balance = $4,
            difference_amount = $5,
            counted_closing_balance_usd = $6,
            counted_closing_balance_cdf = $7,
            expected_closing_balance_usd = $8,
            expected_closing_balance_cdf = $9,
            closing_difference_usd = $10,
            closing_difference_cdf = $11,
            validated_by = $12,
            validated_at = CURRENT_TIMESTAMP,
            closed_ip_address = $13,
            notes = COALESCE($14, notes)
        WHERE tenant_id = $1 AND cash_session_id = $2
        `,
        [
          user.tenantId,
          id,
          legacyCounted,
          legacyExpected,
          legacyDifference,
          countedBalances.usd,
          countedBalances.cdf,
          expectedUsd,
          expectedCdf,
          differenceUsd,
          differenceCdf,
          user.userId,
          ipAddress ?? null,
          dto.notes ?? null,
        ],
      );

      await client.query(
        `
        INSERT INTO audit_logs (
          tenant_id, site_id, user_id, table_name, record_id, action_type, new_value, cash_session_id, workstation_id, workstation_name, ip_address
        )
        VALUES ($1, $2, $3, 'cash_sessions', $4, 'VALIDATE', $5::jsonb, $6, $7, $8, $9)
        `,
        [user.tenantId, session.site_id, user.userId, id, JSON.stringify({
          status: 'CLOSED',
          expectedClosingBalance: legacyExpected,
          countedClosingBalance: legacyCounted,
          differenceAmount: legacyDifference,
          expectedClosingBalanceUsd: expectedUsd,
          expectedClosingBalanceCdf: expectedCdf,
          countedClosingBalanceUsd: countedBalances.usd,
          countedClosingBalanceCdf: countedBalances.cdf,
          closingDifferenceUsd: differenceUsd,
          closingDifferenceCdf: differenceCdf,
        }), id, session.workstation_id, session.workstation_name, ipAddress ?? null],
      );
    });

    return this.findSessionById(user, id);
  }

  async findMovements(user: AuthUser, sessionId?: string) {
    const result = await this.db.query<CashMovementRow>(
      `
      SELECT cm.cash_movement_id, cm.tenant_id, cm.cash_session_id, cm.movement_date,
             cm.movement_type, cm.amount, cm.currency_id, c.currency_code,
             CASE WHEN c.currency_code='CDF' THEN 'FC' WHEN c.currency_code='USD' THEN '$' ELSE c.currency_code END AS currency_symbol,
             cm.reference_type, cm.reference_id, cm.description, cm.created_by
      FROM cash_movements cm
      JOIN cash_sessions cs ON cs.cash_session_id = cm.cash_session_id AND cs.tenant_id = cm.tenant_id
      LEFT JOIN currencies c ON c.currency_id = cm.currency_id
      WHERE cm.tenant_id = $1
        AND ($2::uuid IS NULL OR cs.site_id = $2::uuid)
        AND ($3::uuid IS NULL OR cm.cash_session_id = $3::uuid)
      ORDER BY cm.movement_date DESC
      `,
      [user.tenantId, user.siteId ?? null, sessionId ?? null],
    );
    return result.rows.map(this.toMovement);
  }

  async createExpense(user: AuthUser, dto: CreateCashExpenseDto) {
    await this.db.transaction(async (client) => {
      const session = await client.query<{ cash_session_id: string; site_id: string; cash_register_id: string | null; currency_id: string | null }>(
        `
        SELECT cs.cash_session_id, cs.site_id, cs.cash_register_id, cr.currency_id
        FROM cash_sessions cs
        LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
        WHERE cs.tenant_id = $1 AND cs.cash_session_id = $2 AND cs.status = 'OPEN'
          AND ($3::uuid IS NULL OR cs.site_id = $3::uuid)
        FOR UPDATE OF cs
        `,
        [user.tenantId, dto.cashSessionId, user.siteId ?? null],
      );
      const current = session.rows[0];
      if (!current) throw new BadRequestException('CASH_SESSION_NOT_OPEN');
      const currencyId = dto.currencyId ?? current.currency_id ?? (await this.defaultCurrencyId(client));
      const expenseNumber = `EXP-${Date.now()}`;

      const expense = await client.query<{ cash_expense_id: string }>(
        `
        INSERT INTO cash_expenses (
          tenant_id, cash_session_id, expense_number, expense_category, description,
          amount, currency_id, status, created_by, validated_by, validated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'VALIDATED',$8,$8,CURRENT_TIMESTAMP)
        RETURNING cash_expense_id
        `,
        [user.tenantId, dto.cashSessionId, expenseNumber, dto.expenseCategory, dto.description, dto.amount, currencyId, user.userId],
      );

      await client.query(
        `
        INSERT INTO cash_movements (
          tenant_id, cash_session_id, movement_type, amount, currency_id,
          reference_type, reference_id, description, created_by
        )
        VALUES ($1,$2,'EXPENSE',$3,$4,'CASH_EXPENSE',$5,$6,$7)
        `,
        [user.tenantId, dto.cashSessionId, dto.amount, currencyId, expense.rows[0].cash_expense_id, dto.description, user.userId],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1, $2, 'cash_expenses', $3, 'INSERT', $4::jsonb)
        `,
        [user.tenantId, user.userId, expense.rows[0].cash_expense_id, JSON.stringify({ expenseNumber, amount: dto.amount, status: 'VALIDATED' })],
      );

      await this.accounting.createAutomaticEntry(client, user, {
        journalCode: 'CAI',
        referenceType: 'CASH_EXPENSE',
        referenceId: expense.rows[0].cash_expense_id,
        description: `Depense caisse ${expenseNumber}`,
        lines: [
          { accountCode: '60', debit: dto.amount, description: dto.description },
          { accountCode: '57', credit: dto.amount, description: dto.description },
        ],
      });
    });

    const movements = await this.findMovements(user, dto.cashSessionId);
    return movements[0];
  }

  private async findSessionById(user: AuthUser, id: string) {
    const result = await this.db.query<CashSessionRow>(
      `
      SELECT cs.cash_session_id, cs.tenant_id, cs.site_id, s.site_name, cs.user_id,
             u.full_name AS user_name, cs.cash_register_id, cr.register_name,
             cur.currency_code AS register_currency_code,
             cs.workstation_id, cs.workstation_name,
             cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
             cs.expected_closing_balance, cs.difference_amount,
             cs.opened_ip_address, cs.closed_ip_address, cs.device_uuid,
             cs.counted_closing_balance_usd, cs.counted_closing_balance_cdf,
             cs.expected_closing_balance_usd, cs.expected_closing_balance_cdf,
             cs.closing_difference_usd, cs.closing_difference_cdf,
             cs.status, cs.notes
      FROM cash_sessions cs
      JOIN sites s ON s.site_id = cs.site_id AND s.tenant_id = cs.tenant_id
      LEFT JOIN users u ON u.user_id = cs.user_id AND u.tenant_id = cs.tenant_id
      LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
      LEFT JOIN currencies cur ON cur.currency_id = cr.currency_id
      WHERE cs.tenant_id = $1 AND cs.cash_session_id = $2
        AND ($3::uuid IS NULL OR cs.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, id, user.siteId ?? null],
    );
    return result.rows[0] ? this.toSession(result.rows[0]) : null;
  }

  private async assertSiteAllowed(user: AuthUser, siteId: string) {
    if (user.siteId && user.siteId !== siteId) throw new BadRequestException('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM sites WHERE tenant_id = $1 AND site_id = $2 AND is_active = true`,
      [user.tenantId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new BadRequestException('SITE_NOT_IN_TENANT');
  }

  private async assertCashRegister(user: AuthUser, siteId: string, cashRegisterId: string) {
    const result = await this.db.query<{ total: string }>(
      `
      SELECT COUNT(*)::int AS total
      FROM cash_registers
      WHERE tenant_id = $1 AND site_id = $2 AND cash_register_id = $3 AND is_active = true
      `,
      [user.tenantId, siteId, cashRegisterId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new BadRequestException('CASH_REGISTER_NOT_IN_TENANT');
  }

  private async assertWorkstation(user: AuthUser, siteId: string, workstationId: string) {
    const result = await this.db.query<{ workstation_id: string; workstation_name: string }>(
      `
      SELECT workstation_id, workstation_name
      FROM pos_workstations
      WHERE tenant_id = $1 AND site_id = $2 AND workstation_id = $3 AND is_active = true
      `,
      [user.tenantId, siteId, workstationId],
    );
    if (!result.rows[0]) throw new BadRequestException('WORKSTATION_NOT_IN_TENANT');
    return result.rows[0];
  }

  private async defaultCurrencyId(client: Queryable) {
    const result = await client.query<{ currency_id: string }>(
      `SELECT currency_id FROM currencies WHERE currency_code = 'USD' OR is_default = true ORDER BY is_default DESC LIMIT 1`,
    );
    if (!result.rows[0]) throw new BadRequestException('CURRENCY_NOT_FOUND');
    return result.rows[0].currency_id;
  }

  private toSession(row: CashSessionRow) {
    const registerCurrencyCode = row.register_currency_code ?? 'USD';
    const openingBalance = Number(row.opening_balance);
    const openingBalanceUsd = registerCurrencyCode === 'CDF' ? 0 : openingBalance;
    const openingBalanceCdf = registerCurrencyCode === 'CDF' ? openingBalance : 0;
    const expectedClosingBalanceUsd = row.expected_closing_balance_usd === null
      ? (registerCurrencyCode === 'CDF' ? 0 : Number(row.expected_closing_balance))
      : Number(row.expected_closing_balance_usd);
    const expectedClosingBalanceCdf = row.expected_closing_balance_cdf === null
      ? (registerCurrencyCode === 'CDF' ? Number(row.expected_closing_balance) : 0)
      : Number(row.expected_closing_balance_cdf);
    const countedClosingBalanceUsd = row.counted_closing_balance_usd === null
      ? (registerCurrencyCode === 'CDF' ? 0 : Number(row.closing_balance ?? 0))
      : Number(row.counted_closing_balance_usd);
    const countedClosingBalanceCdf = row.counted_closing_balance_cdf === null
      ? (registerCurrencyCode === 'CDF' ? Number(row.closing_balance ?? 0) : 0)
      : Number(row.counted_closing_balance_cdf);
    const closingDifferenceUsd = row.closing_difference_usd === null
      ? (registerCurrencyCode === 'CDF' ? 0 : Number(row.difference_amount))
      : Number(row.closing_difference_usd);
    const closingDifferenceCdf = row.closing_difference_cdf === null
      ? (registerCurrencyCode === 'CDF' ? Number(row.difference_amount) : 0)
      : Number(row.closing_difference_cdf);
    return {
      cashSessionId: row.cash_session_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      userId: row.user_id,
      userName: row.user_name,
      cashRegisterId: row.cash_register_id,
      registerName: row.register_name,
      registerCurrencyCode,
      workstationId: row.workstation_id,
      workstationName: row.workstation_name,
      sessionLabel: `${row.user_name ?? 'Utilisateur'} • ${row.workstation_name ?? 'Poste non renseigne'} • ${row.status === 'OPEN' ? 'Ouverte' : 'Fermee'}`,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      openedIpAddress: row.opened_ip_address,
      closedIpAddress: row.closed_ip_address,
      deviceUuid: row.device_uuid,
      openingBalance,
      openingBalanceUsd,
      openingBalanceCdf,
      closingBalance: row.closing_balance === null ? null : Number(row.closing_balance),
      expectedClosingBalance: Number(row.expected_closing_balance),
      differenceAmount: Number(row.difference_amount),
      countedClosingBalanceUsd,
      countedClosingBalanceCdf,
      expectedClosingBalanceUsd,
      expectedClosingBalanceCdf,
      closingDifferenceUsd,
      closingDifferenceCdf,
      status: row.status,
      notes: row.notes,
    };
  }

  private countedBalancesByCurrency(dto: CloseCashSessionDto, registerCurrencyCode: string | null) {
    if (
      dto.countedClosingBalance === undefined
      && dto.countedClosingBalanceUsd === undefined
      && dto.countedClosingBalanceCdf === undefined
    ) {
      throw new BadRequestException('COUNTED_CLOSING_BALANCE_REQUIRED');
    }
    const primaryCurrency = registerCurrencyCode === 'CDF' ? 'CDF' : 'USD';
    const legacyValue = Number(dto.countedClosingBalance ?? 0);
    return {
      usd: this.roundMoney(Number(dto.countedClosingBalanceUsd ?? (primaryCurrency === 'USD' ? legacyValue : 0))),
      cdf: this.roundMoney(Number(dto.countedClosingBalanceCdf ?? (primaryCurrency === 'CDF' ? legacyValue : 0))),
    };
  }

  private openingBalancesByCurrency(openingBalance: string, registerCurrencyCode: string | null) {
    const opening = Number(openingBalance);
    return {
      usd: registerCurrencyCode === 'CDF' ? 0 : opening,
      cdf: registerCurrencyCode === 'CDF' ? opening : 0,
    };
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toMovement(row: CashMovementRow) {
    return {
      cashMovementId: row.cash_movement_id,
      cashSessionId: row.cash_session_id,
      movementDate: row.movement_date,
      movementType: row.movement_type,
      amount: Number(row.amount),
      currencyId: row.currency_id,
      currencyCode: row.currency_code,
      currencySymbol: row.currency_symbol,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      description: row.description,
      createdBy: row.created_by,
    };
  }
}
