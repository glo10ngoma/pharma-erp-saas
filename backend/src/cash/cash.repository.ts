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
  opened_at: Date;
  closed_at: Date | null;
  opening_balance: string;
  closing_balance: string | null;
  expected_closing_balance: string;
  difference_amount: string;
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
             cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
             cs.expected_closing_balance, cs.difference_amount, cs.status, cs.notes
      FROM cash_sessions cs
      JOIN sites s ON s.site_id = cs.site_id AND s.tenant_id = cs.tenant_id
      LEFT JOIN users u ON u.user_id = cs.user_id AND u.tenant_id = cs.tenant_id
      LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
      WHERE cs.tenant_id = $1
        AND ($2::uuid IS NULL OR cs.site_id = $2::uuid)
      ORDER BY cs.opened_at DESC
      `,
      [user.tenantId, user.siteId ?? null],
    );
    return result.rows.map(this.toSession);
  }

  async currentSession(user: AuthUser, siteId?: string) {
    if (siteId) await this.assertSiteAllowed(user, siteId);
    const result = await this.db.query<CashSessionRow>(
      `
      SELECT cs.cash_session_id, cs.tenant_id, cs.site_id, s.site_name, cs.user_id,
             u.full_name AS user_name, cs.cash_register_id, cr.register_name,
             cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
             cs.expected_closing_balance, cs.difference_amount, cs.status, cs.notes
      FROM cash_sessions cs
      JOIN sites s ON s.site_id = cs.site_id AND s.tenant_id = cs.tenant_id
      LEFT JOIN users u ON u.user_id = cs.user_id AND u.tenant_id = cs.tenant_id
      LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
      WHERE cs.tenant_id = $1
        AND cs.user_id = $2
        AND cs.status = 'OPEN'
        AND ($3::uuid IS NULL OR cs.site_id = $3::uuid)
        AND ($4::uuid IS NULL OR cs.site_id = $4::uuid)
      ORDER BY cs.opened_at DESC
      LIMIT 1
      `,
      [user.tenantId, user.userId, siteId ?? null, user.siteId ?? null],
    );
    return result.rows[0] ? this.toSession(result.rows[0]) : null;
  }

  async openSession(user: AuthUser, dto: OpenCashSessionDto) {
    await this.assertSiteAllowed(user, dto.siteId);
    if (dto.cashRegisterId) await this.assertCashRegister(user, dto.siteId, dto.cashRegisterId);

    return this.db.transaction(async (client) => {
      const existing = await client.query<{ total: string }>(
        `
        SELECT COUNT(*)::int AS total
        FROM cash_sessions
        WHERE tenant_id = $1 AND site_id = $2 AND user_id = $3 AND status = 'OPEN'
        `,
        [user.tenantId, dto.siteId, user.userId],
      );
      if (Number(existing.rows[0]?.total ?? 0) > 0) throw new ConflictException('CASH_SESSION_ALREADY_OPEN');

      const created = await client.query<{ cash_session_id: string }>(
        `
        INSERT INTO cash_sessions (tenant_id, site_id, user_id, cash_register_id, opening_balance, status, notes)
        VALUES ($1, $2, $3, $4, $5, 'OPEN', $6)
        RETURNING cash_session_id
        `,
        [user.tenantId, dto.siteId, user.userId, dto.cashRegisterId ?? null, dto.openingBalance, dto.notes ?? null],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1, $2, 'cash_sessions', $3, 'INSERT', $4::jsonb)
        `,
        [user.tenantId, user.userId, created.rows[0].cash_session_id, JSON.stringify({ status: 'OPEN', openingBalance: dto.openingBalance })],
      );

      return created.rows[0].cash_session_id;
    }).then((id) => this.findSessionById(user, id));
  }

  async closeSession(user: AuthUser, id: string, dto: CloseCashSessionDto) {
    await this.db.transaction(async (client) => {
      const locked = await client.query<CashSessionRow>(
        `
        SELECT cs.cash_session_id, cs.tenant_id, cs.site_id, NULL::text AS site_name, cs.user_id,
               NULL::text AS user_name, cs.cash_register_id, NULL::text AS register_name,
               cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
               cs.expected_closing_balance, cs.difference_amount, cs.status, cs.notes
        FROM cash_sessions cs
        WHERE cs.tenant_id = $1 AND cs.cash_session_id = $2
          AND ($3::uuid IS NULL OR cs.site_id = $3::uuid)
        FOR UPDATE
        `,
        [user.tenantId, id, user.siteId ?? null],
      );
      const session = locked.rows[0];
      if (!session) throw new NotFoundException('CASH_SESSION_NOT_FOUND');
      if (session.status !== 'OPEN') throw new BadRequestException('CASH_SESSION_NOT_OPEN');

      const totals = await client.query<{ total_cash_in: string; total_cash_out: string }>(
        `
        SELECT
          COALESCE(SUM(CASE WHEN movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT') THEN amount ELSE 0 END),0)::numeric AS total_cash_in,
          COALESCE(SUM(CASE WHEN movement_type IN ('EXPENSE','CASH_OUT','BANK_DEPOSIT') THEN amount ELSE 0 END),0)::numeric AS total_cash_out
        FROM cash_movements
        WHERE tenant_id = $1 AND cash_session_id = $2
        `,
        [user.tenantId, id],
      );

      const opening = Number(session.opening_balance);
      const totalIn = Number(totals.rows[0]?.total_cash_in ?? 0);
      const totalOut = Number(totals.rows[0]?.total_cash_out ?? 0);
      const expected = opening + totalIn - totalOut;
      const difference = dto.countedClosingBalance - expected;

      await client.query(
        `
        UPDATE cash_sessions
        SET status = 'CLOSED',
            closed_at = CURRENT_TIMESTAMP,
            closing_balance = $3,
            expected_closing_balance = $4,
            difference_amount = $5,
            validated_by = $6,
            validated_at = CURRENT_TIMESTAMP,
            notes = COALESCE($7, notes)
        WHERE tenant_id = $1 AND cash_session_id = $2
        `,
        [user.tenantId, id, dto.countedClosingBalance, expected, difference, user.userId, dto.notes ?? null],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1, $2, 'cash_sessions', $3, 'VALIDATE', $4::jsonb)
        `,
        [user.tenantId, user.userId, id, JSON.stringify({ status: 'CLOSED', expectedClosingBalance: expected, countedClosingBalance: dto.countedClosingBalance, differenceAmount: difference })],
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
             cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance,
             cs.expected_closing_balance, cs.difference_amount, cs.status, cs.notes
      FROM cash_sessions cs
      JOIN sites s ON s.site_id = cs.site_id AND s.tenant_id = cs.tenant_id
      LEFT JOIN users u ON u.user_id = cs.user_id AND u.tenant_id = cs.tenant_id
      LEFT JOIN cash_registers cr ON cr.cash_register_id = cs.cash_register_id AND cr.tenant_id = cs.tenant_id
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

  private async defaultCurrencyId(client: Queryable) {
    const result = await client.query<{ currency_id: string }>(
      `SELECT currency_id FROM currencies WHERE currency_code = 'USD' OR is_default = true ORDER BY is_default DESC LIMIT 1`,
    );
    if (!result.rows[0]) throw new BadRequestException('CURRENCY_NOT_FOUND');
    return result.rows[0].currency_id;
  }

  private toSession(row: CashSessionRow) {
    return {
      cashSessionId: row.cash_session_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      userId: row.user_id,
      userName: row.user_name,
      cashRegisterId: row.cash_register_id,
      registerName: row.register_name,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      openingBalance: Number(row.opening_balance),
      closingBalance: row.closing_balance === null ? null : Number(row.closing_balance),
      expectedClosingBalance: Number(row.expected_closing_balance),
      differenceAmount: Number(row.difference_amount),
      status: row.status,
      notes: row.notes,
    };
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
