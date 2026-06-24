import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountingRepository } from '../accounting/accounting.repository';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { PayReceivableDto } from './dto/pay-receivable.dto';

type Row = {
  receivable_id: string;
  tenant_id: string;
  sale_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  currency_id: string;
  currency_code: string | null;
  currency_symbol: string | null;
  receivable_type: string;
  invoice_number: string | null;
  issue_date: string;
  due_date: string | null;
  amount_due: string;
  amount_paid: string;
  balance: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
};

@Injectable()
export class ReceivablesRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly accounting: AccountingRepository,
  ) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<Row>(
      this.baseSql(`WHERE ar.tenant_id=$1 AND ($2::uuid IS NULL OR s.site_id=$2::uuid) ORDER BY ar.created_at DESC`),
      [user.tenantId, user.siteId ?? null],
    );
    return result.rows.map(this.toDto);
  }

  async findOne(user: AuthUser, id: string) {
    const result = await this.db.query<Row>(
      this.baseSql(`WHERE ar.tenant_id=$1 AND ar.receivable_id=$2 AND ($3::uuid IS NULL OR s.site_id=$3::uuid) LIMIT 1`),
      [user.tenantId, id, user.siteId ?? null],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  async summary(user: AuthUser) {
    const result = await this.db.query(
      `SELECT ar.receivable_type AS "receivableType",
              ar.status,
              cur.currency_code AS "currencyCode",
              CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS "currencySymbol",
              COUNT(*)::int AS count,
              COALESCE(SUM(ar.amount_due),0)::numeric AS "amountDue",
              COALESCE(SUM(ar.amount_paid),0)::numeric AS "amountPaid",
              COALESCE(SUM(ar.balance),0)::numeric AS balance
       FROM accounts_receivable ar
       LEFT JOIN sales s ON s.sale_id=ar.sale_id AND s.tenant_id=ar.tenant_id
       LEFT JOIN currencies cur ON cur.currency_id=ar.currency_id
       WHERE ar.tenant_id=$1 AND ($2::uuid IS NULL OR s.site_id=$2::uuid)
       GROUP BY ar.receivable_type, ar.status, cur.currency_code
       ORDER BY ar.receivable_type, ar.status`,
      [user.tenantId, user.siteId ?? null],
    );
    return result.rows.map((row: any) => ({
      ...row,
      amountDue: Number(row.amountDue),
      amountPaid: Number(row.amountPaid),
      balance: Number(row.balance),
    }));
  }

  async pay(user: AuthUser, id: string, dto: PayReceivableDto) {
    await this.db.transaction(async (client) => {
      const receivable = await client.query<{ receivable_id: string; currency_id: string; amount_paid: string; balance: string }>(
        `SELECT ar.receivable_id, ar.currency_id, ar.amount_paid, ar.balance
         FROM accounts_receivable ar
         LEFT JOIN sales s ON s.sale_id=ar.sale_id AND s.tenant_id=ar.tenant_id
         WHERE ar.tenant_id=$1 AND ar.receivable_id=$2 AND ar.status <> 'CANCELLED'
           AND ($3::uuid IS NULL OR s.site_id=$3::uuid)
         FOR UPDATE OF ar`,
        [user.tenantId, id, user.siteId ?? null],
      );
      const row = receivable.rows[0];
      if (!row) throw new Error('RECEIVABLE_NOT_FOUND');
      if (dto.amount > Number(row.balance)) throw new BadRequestException('RECEIVABLE_PAYMENT_TOO_HIGH');

      const methodId = dto.paymentMethodId ?? (await this.defaultPaymentMethodId(client));
      const newPaid = Number(row.amount_paid) + dto.amount;
      const newBalance = Number(row.balance) - dto.amount;
      const status = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
      const payment = await client.query<{ receivable_payment_id: string }>(
        `INSERT INTO receivable_payments (tenant_id, receivable_id, payment_method_id, currency_id, amount, reference_payment, received_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING receivable_payment_id`,
        [user.tenantId, id, methodId, row.currency_id, dto.amount, dto.referencePayment ?? null, user.userId, dto.notes ?? null],
      );
      await client.query(`UPDATE accounts_receivable SET amount_paid=$3, balance=$4, status=$5 WHERE tenant_id=$1 AND receivable_id=$2`, [user.tenantId, id, newPaid, newBalance, status]);
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
         VALUES ($1,$2,'accounts_receivable',$3,'UPDATE',$4::jsonb)`,
        [user.tenantId, user.userId, id, JSON.stringify({ amountPaid: newPaid, balance: newBalance, status })],
      );

      const paymentMethod = await client.query<{ method_code: string }>(`SELECT method_code FROM payment_methods WHERE payment_method_id=$1 LIMIT 1`, [methodId]);
      const isBank = ['BANK', 'BANQUE', 'TRANSFER', 'VIREMENT'].includes(paymentMethod.rows[0]?.method_code ?? '');
      await this.accounting.createAutomaticEntry(client, user, {
        journalCode: isBank ? 'BAN' : 'CAI',
        referenceType: 'RECEIVABLE_PAYMENT',
        referenceId: payment.rows[0].receivable_payment_id,
        description: `Paiement creance ${id}`,
        lines: [
          { accountCode: isBank ? '52' : '57', debit: dto.amount, description: `Paiement creance ${id}` },
          { accountCode: '41', credit: dto.amount, description: `Paiement creance ${id}` },
        ],
      });
    });
    return this.findOne(user, id);
  }

  private baseSql(where: string) {
    return `SELECT ar.receivable_id, ar.tenant_id, ar.sale_id, ar.customer_id,
                  c.customer_name, ar.organization_id, o.organization_name,
                  ar.currency_id, cur.currency_code,
                  CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS currency_symbol,
                  ar.receivable_type, ar.invoice_number, ar.issue_date, ar.due_date,
                  ar.amount_due, ar.amount_paid, ar.balance, ar.status, ar.notes,
                  ar.created_by, ar.created_at
           FROM accounts_receivable ar
           LEFT JOIN sales s ON s.sale_id=ar.sale_id AND s.tenant_id=ar.tenant_id
           LEFT JOIN customers c ON c.customer_id=ar.customer_id AND c.tenant_id=ar.tenant_id
           LEFT JOIN organizations o ON o.organization_id=ar.organization_id AND o.tenant_id=ar.tenant_id
           LEFT JOIN currencies cur ON cur.currency_id=ar.currency_id
           ${where}`;
  }

  private async defaultPaymentMethodId(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ payment_method_id: string }> }> }) {
    const result = await client.query(`SELECT payment_method_id FROM payment_methods WHERE method_code='CASH' LIMIT 1`);
    if (!result.rows[0]) throw new Error('PAYMENT_METHOD_NOT_FOUND');
    return result.rows[0].payment_method_id;
  }

  private toDto(row: Row) {
    return {
      receivableId: row.receivable_id,
      tenantId: row.tenant_id,
      saleId: row.sale_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      currencyId: row.currency_id,
      currencyCode: row.currency_code,
      currencySymbol: row.currency_symbol,
      receivableType: row.receivable_type,
      invoiceNumber: row.invoice_number,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      amountDue: Number(row.amount_due),
      amountPaid: Number(row.amount_paid),
      balance: Number(row.balance),
      status: row.status,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
