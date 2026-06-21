import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AccountingRepository } from '../accounting/accounting.repository';
import { DatabaseService } from '../database/database.service';
import { AddSaleItemFefoDto } from './dto/add-sale-item-fefo.dto';
import { ApplyInsuranceDto } from './dto/apply-insurance.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ValidateSaleDto } from './dto/validate-sale.dto';

type SaleRow = { sale_id: string; tenant_id: string; sale_number: string; sale_date: Date; customer_id: string | null; customer_name: string | null; organization_id?: string | null; membership_id?: string | null; site_id: string; site_name: string | null; currency_id: string; exchange_rate: string; subtotal: string; insurance_covered_amount?: string; customer_payable_amount?: string; credit_amount?: string; total_amount: string; sale_type: string; status: string; created_by: string | null; created_at: Date; validated_at: Date | null };
type ItemRow = { sale_item_id: string; tenant_id: string; sale_id: string; article_id: string; article_code: string | null; commercial_name: string | null; lot_id: string; lot_number: string | null; expiry_date: string | null; quantity: string; unit_price: string; line_total: string };

@Injectable()
export class SalesRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly accounting: AccountingRepository,
  ) {}

  async findAll(user: AuthUser) {
    const r = await this.db.query<SaleRow>(
      `SELECT s.sale_id, s.tenant_id, s.sale_number, s.sale_date, s.customer_id, c.customer_name,
              s.organization_id, s.membership_id, s.site_id, st.site_name, s.currency_id, s.exchange_rate, s.subtotal,
              s.insurance_covered_amount, s.customer_payable_amount, s.credit_amount, s.total_amount,
              s.sale_type, s.status, s.created_by, s.created_at, s.validated_at
       FROM sales s
       JOIN sites st ON st.site_id=s.site_id AND st.tenant_id=s.tenant_id
       LEFT JOIN customers c ON c.customer_id=s.customer_id AND c.tenant_id=s.tenant_id
       WHERE s.tenant_id=$1
         AND ($2::uuid IS NULL OR s.site_id=$2::uuid)
       ORDER BY s.sale_date DESC`,
      [user.tenantId, user.siteId ?? null],
    );
    return r.rows.map(this.toSale);
  }

  async findOne(user: AuthUser, id: string) {
    const r = await this.db.query<SaleRow>(
      `SELECT s.sale_id, s.tenant_id, s.sale_number, s.sale_date, s.customer_id, c.customer_name,
              s.organization_id, s.membership_id, s.site_id, st.site_name, s.currency_id, s.exchange_rate, s.subtotal,
              s.insurance_covered_amount, s.customer_payable_amount, s.credit_amount, s.total_amount,
              s.sale_type, s.status, s.created_by, s.created_at, s.validated_at
       FROM sales s
       JOIN sites st ON st.site_id=s.site_id AND st.tenant_id=s.tenant_id
       LEFT JOIN customers c ON c.customer_id=s.customer_id AND c.tenant_id=s.tenant_id
       WHERE s.tenant_id=$1 AND s.sale_id=$2
         AND ($3::uuid IS NULL OR s.site_id=$3::uuid)
       LIMIT 1`,
      [user.tenantId, id, user.siteId ?? null],
    );
    if (!r.rows[0]) return null;
    return { ...this.toSale(r.rows[0]), items: await this.findItems(user, id), payments: await this.findPayments(user, id) };
  }

  async create(user: AuthUser, dto: CreateSaleDto) {
    await this.assertRelations(user, dto.siteId, dto.currencyId, dto.customerId);
    const number = `SAL-${Date.now()}`;
    const r = await this.db.query<SaleRow>(
      `INSERT INTO sales (tenant_id, sale_number, site_id, customer_id, currency_id, exchange_rate, sale_type, created_by)
       VALUES ($1,$2,$3,$4,$5,1,$7,$6)
       RETURNING sale_id, tenant_id, sale_number, sale_date, customer_id, NULL::text AS customer_name, organization_id, membership_id, site_id, NULL::text AS site_name, currency_id, exchange_rate, subtotal, insurance_covered_amount, customer_payable_amount, credit_amount, total_amount, sale_type, status, created_by, created_at, validated_at`,
      [user.tenantId, number, dto.siteId, dto.customerId ?? null, dto.currencyId, user.userId, dto.saleType ?? 'CASH'],
    );
    return this.findOne(user, r.rows[0].sale_id);
  }

  async addItemFefo(user: AuthUser, saleId: string, dto: AddSaleItemFefoDto) {
    const sale = await this.findOne(user, saleId);
    if (!sale) return null;
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');
    await this.assertArticle(user, dto.articleId);

    const available = await this.db.query<{ lot_id: string; selling_price: string; expiry_date: string; quantity_available: string }>(
      `SELECT l.lot_id, l.selling_price, l.expiry_date, SUM(st.quantity_available)::numeric AS quantity_available
       FROM lots l
       JOIN stocks st ON st.lot_id=l.lot_id AND st.tenant_id=l.tenant_id
       WHERE l.tenant_id=$1 AND l.article_id=$2 AND st.site_id=$3
         AND st.quantity_available > 0 AND l.expiry_date > CURRENT_DATE AND l.is_blocked=false
       GROUP BY l.lot_id
       ORDER BY l.expiry_date ASC`,
      [user.tenantId, dto.articleId, sale.siteId],
    );
    let remaining = dto.quantity;
    for (const lot of available.rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(lot.quantity_available));
      const price = Number(lot.selling_price);
      await this.db.query(
        `INSERT INTO sale_items (tenant_id, sale_id, article_id, lot_id, quantity, unit_price, patient_amount, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        [user.tenantId, saleId, dto.articleId, lot.lot_id, take, price, take * price],
      );
      remaining -= take;
    }
    if (remaining > 0) throw new Error('STOCK_INSUFFICIENT');
    await this.recalculateTotal(user, saleId);
    return this.findOne(user, saleId);
  }

  async applyInsurance(user: AuthUser, saleId: string, dto: ApplyInsuranceDto) {
    const sale = await this.findOne(user, saleId);
    if (!sale) return null;
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');
    if (!sale.customerId) throw new Error('CUSTOMER_REQUIRED_FOR_INSURANCE');

    const membership = await this.db.query<{ membership_id: string; organization_id: string; plan_id: string; coverage_percent: string }>(
      `SELECT cm.membership_id, cm.organization_id, cm.plan_id, ip.coverage_percent
       FROM customer_memberships cm
       JOIN customers c ON c.customer_id=cm.customer_id AND c.tenant_id=cm.tenant_id
       JOIN organizations o ON o.organization_id=cm.organization_id AND o.tenant_id=cm.tenant_id
       JOIN insurance_plans ip ON ip.plan_id=cm.plan_id AND ip.organization_id=cm.organization_id
       WHERE cm.tenant_id=$1 AND cm.membership_id=$2 AND cm.customer_id=$3
         AND cm.is_active=true AND o.is_active=true AND ip.is_active=true
         AND (cm.valid_from IS NULL OR cm.valid_from <= CURRENT_DATE)
         AND (cm.valid_to IS NULL OR cm.valid_to >= CURRENT_DATE)
       LIMIT 1`,
      [user.tenantId, dto.membershipId, sale.customerId],
    );
    const current = membership.rows[0];
    if (!current) throw new Error('MEMBERSHIP_NOT_ACTIVE');
    const coverage = Number(current.coverage_percent);
    if (coverage < 0 || coverage > 100) throw new Error('INSURANCE_PLAN_NOT_ACTIVE');

    await this.db.query(
      `UPDATE sale_items
       SET coverage_percent=$3,
           covered_amount=ROUND(line_total * $3 / 100, 2),
           patient_amount=line_total - ROUND(line_total * $3 / 100, 2)
       WHERE tenant_id=$1 AND sale_id=$2`,
      [user.tenantId, saleId, coverage],
    );
    await this.db.query(
      `UPDATE sales
       SET sale_type='INSURANCE',
           organization_id=$3,
           membership_id=$4,
           insurance_covered_amount=COALESCE((SELECT SUM(covered_amount) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0),
           customer_payable_amount=COALESCE((SELECT SUM(patient_amount) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0),
           credit_amount=COALESCE((SELECT SUM(covered_amount) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0),
           total_amount=COALESCE((SELECT SUM(line_total) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0)
       WHERE tenant_id=$1 AND sale_id=$2`,
      [user.tenantId, saleId, current.organization_id, current.membership_id],
    );
    return this.findOne(user, saleId);
  }

  async removeItem(user: AuthUser, saleId: string, itemId: string) {
    const sale = await this.findOne(user, saleId);
    if (!sale) return null;
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');
    await this.db.query(`DELETE FROM sale_items WHERE tenant_id=$1 AND sale_id=$2 AND sale_item_id=$3`, [user.tenantId, saleId, itemId]);
    await this.recalculateTotal(user, saleId);
    return this.findOne(user, saleId);
  }

  async cancel(user: AuthUser, saleId: string) {
    const sale = await this.findOne(user, saleId);
    if (!sale) return null;
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');
    await this.db.query(`UPDATE sales SET status='CANCELLED' WHERE tenant_id=$1 AND sale_id=$2`, [user.tenantId, saleId]);
    return this.findOne(user, saleId);
  }

  async validate(user: AuthUser, saleId: string, dto: ValidateSaleDto) {
    await this.db.transaction(async (client) => {
      const saleResult = await client.query<SaleRow>(
        `SELECT sale_id, tenant_id, sale_number, sale_date, customer_id, NULL::text AS customer_name,
                organization_id, membership_id, site_id, NULL::text AS site_name, currency_id, exchange_rate, subtotal,
                insurance_covered_amount, customer_payable_amount, credit_amount, total_amount,
                sale_type, status, created_by, created_at, validated_at
         FROM sales WHERE tenant_id=$1 AND sale_id=$2
           AND ($3::uuid IS NULL OR site_id=$3::uuid)
         FOR UPDATE`,
        [user.tenantId, saleId, user.siteId ?? null],
      );
      const sale = saleResult.rows[0];
      if (!sale) throw new Error('SALE_NOT_FOUND');
      if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');
      const total = Number(sale.total_amount);
      const patientPayable = sale.sale_type === 'INSURANCE' ? Number(sale.customer_payable_amount ?? 0) : total;
      const insuranceCovered = Number(sale.insurance_covered_amount ?? 0);
      if (total <= 0) throw new Error('SALE_HAS_NO_ITEMS');
      if (sale.sale_type === 'INSURANCE' && (!sale.customer_id || !sale.organization_id || !sale.membership_id || insuranceCovered <= 0)) throw new Error('MEMBERSHIP_NOT_ACTIVE');
      if (dto.amountPaid < patientPayable) throw new Error('PAYMENT_INSUFFICIENT');

      const items = await client.query<ItemRow>(
        `SELECT si.sale_item_id, si.tenant_id, si.sale_id, si.article_id, NULL::text AS article_code,
                NULL::text AS commercial_name, si.lot_id, NULL::text AS lot_number, NULL::date AS expiry_date,
                si.quantity, si.unit_price, si.line_total
         FROM sale_items si WHERE si.tenant_id=$1 AND si.sale_id=$2`,
        [user.tenantId, saleId],
      );
      if (!items.rows.length) throw new Error('SALE_HAS_NO_ITEMS');

      for (const item of items.rows) {
        const stock = await client.query<{ stock_id: string; quantity_available: string; expiry_date: string; is_blocked: boolean }>(
          `SELECT st.stock_id, st.quantity_available, l.expiry_date, l.is_blocked
           FROM stocks st
           JOIN lots l ON l.lot_id=st.lot_id AND l.tenant_id=st.tenant_id
           WHERE st.tenant_id=$1 AND st.site_id=$2 AND st.lot_id=$3
           FOR UPDATE`,
          [user.tenantId, sale.site_id, item.lot_id],
        );
        const row = stock.rows[0];
        if (!row || Number(row.quantity_available) < Number(item.quantity)) throw new Error('STOCK_INSUFFICIENT');
        if (new Date(row.expiry_date) <= new Date()) throw new Error('LOT_EXPIRED');
        if (row.is_blocked) throw new Error('LOT_BLOCKED');
        await client.query(`UPDATE stocks SET quantity_available=quantity_available-$4, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND site_id=$2 AND lot_id=$3`, [user.tenantId, sale.site_id, item.lot_id, item.quantity]);
        await client.query(
          `INSERT INTO stock_movements (tenant_id, site_id, article_id, lot_id, movement_type, quantity, reference_type, reference_id, notes, user_id)
           VALUES ($1,$2,$3,$4,'SALE_OUT',$5,'SALE',$6,$7,$8)`,
          [user.tenantId, sale.site_id, item.article_id, item.lot_id, item.quantity, sale.sale_id, `Validation vente ${sale.sale_number}`, user.userId],
        );
      }

      const methodId = dto.paymentMethodId ?? (await this.defaultPaymentMethodId(client));
      if (patientPayable > 0) {
        await client.query(
          `INSERT INTO payments (tenant_id, sale_id, payment_method_id, currency_id, amount, reference_payment, received_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [user.tenantId, saleId, methodId, sale.currency_id, dto.amountPaid, dto.referencePayment ?? null, user.userId],
        );
      }
      if ((sale.sale_type === 'CASH' || sale.sale_type === 'INSURANCE') && dto.amountPaid > 0) {
        const session = await client.query<{ cash_session_id: string }>(
          `SELECT cash_session_id
           FROM cash_sessions
           WHERE tenant_id=$1 AND site_id=$2 AND user_id=$3 AND status='OPEN'
           ORDER BY opened_at DESC
           LIMIT 1`,
          [user.tenantId, sale.site_id, user.userId],
        );
        if (session.rows[0]) {
          await client.query(
            `INSERT INTO cash_movements (
               tenant_id, cash_session_id, movement_type, amount, currency_id,
               reference_type, reference_id, description, created_by
             )
             VALUES ($1,$2,'SALE_PAYMENT',$3,$4,'SALE',$5,$6,$7)`,
            [
              user.tenantId,
              session.rows[0].cash_session_id,
              dto.amountPaid,
              sale.currency_id,
              sale.sale_id,
              `Paiement vente ${sale.sale_number}`,
              user.userId,
            ],
          );
        }
      }
      if (sale.sale_type === 'INSURANCE' && insuranceCovered > 0) {
        await client.query(
          `INSERT INTO accounts_receivable (
             tenant_id, sale_id, customer_id, organization_id, currency_id, receivable_type,
             invoice_number, due_date, amount_due, amount_paid, balance, status, notes, created_by
           )
           VALUES ($1,$2,$3,$4,$5,'INSURANCE_CLAIM',$6,CURRENT_DATE + INTERVAL '30 days',$7,0,$7,'OPEN',$8,$9)`,
          [user.tenantId, saleId, sale.customer_id, sale.organization_id, sale.currency_id, `AR-${sale.sale_number}`, insuranceCovered, `Creance assurance vente ${sale.sale_number}`, user.userId],
        );
      }
      const accountingLines = [
        ...(patientPayable > 0 ? [{ accountCode: '57', debit: patientPayable, description: `Encaissement vente ${sale.sale_number}` }] : []),
        ...(sale.sale_type === 'INSURANCE' && insuranceCovered > 0 ? [{ accountCode: '41', debit: insuranceCovered, description: `Creance assurance vente ${sale.sale_number}` }] : []),
        { accountCode: '70', credit: total, description: `Vente marchandises ${sale.sale_number}` },
      ];
      await this.accounting.createAutomaticEntry(client, user, {
        journalCode: 'VEN',
        referenceType: 'SALE',
        referenceId: sale.sale_id,
        description: `Validation vente ${sale.sale_number}`,
        lines: accountingLines,
      });
      await client.query(`UPDATE sales SET status='VALIDATED', validated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND sale_id=$2`, [user.tenantId, saleId]);
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
         VALUES ($1,$2,'sales',$3,'VALIDATE',$4::jsonb)`,
        [user.tenantId, user.userId, saleId, JSON.stringify({ status: 'VALIDATED', saleNumber: sale.sale_number })],
      );
    });
    return this.findOne(user, saleId);
  }

  private async defaultPaymentMethodId(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ payment_method_id: string }> }> }) {
    const result = await client.query(`SELECT payment_method_id FROM payment_methods WHERE method_code='CASH' LIMIT 1`);
    if (!result.rows[0]) throw new Error('PAYMENT_METHOD_NOT_FOUND');
    return result.rows[0].payment_method_id;
  }

  private async findItems(user: AuthUser, saleId: string) {
    const r = await this.db.query<ItemRow>(
      `SELECT si.sale_item_id, si.tenant_id, si.sale_id, si.article_id, a.article_code, a.commercial_name,
              si.lot_id, l.lot_number, l.expiry_date, si.quantity, si.unit_price, si.line_total
       FROM sale_items si
       JOIN articles a ON a.article_id=si.article_id AND a.tenant_id=si.tenant_id
       JOIN lots l ON l.lot_id=si.lot_id AND l.tenant_id=si.tenant_id
       WHERE si.tenant_id=$1 AND si.sale_id=$2 ORDER BY si.sale_item_id`,
      [user.tenantId, saleId],
    );
    return r.rows.map(this.toItem);
  }

  private async findPayments(user: AuthUser, saleId: string) {
    const r = await this.db.query(
      `SELECT p.payment_id, p.sale_id, p.payment_date, p.payment_method_id, pm.method_name, p.currency_id, p.amount, p.reference_payment, p.received_by
       FROM payments p JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id
       WHERE p.tenant_id=$1 AND p.sale_id=$2 ORDER BY p.payment_date`,
      [user.tenantId, saleId],
    );
    return r.rows.map((row) => ({ paymentId: row.payment_id, saleId: row.sale_id, paymentDate: row.payment_date, paymentMethodId: row.payment_method_id, methodName: row.method_name, currencyId: row.currency_id, amount: Number(row.amount), referencePayment: row.reference_payment, receivedBy: row.received_by }));
  }

  private async recalculateTotal(user: AuthUser, saleId: string) {
    await this.db.query(
      `UPDATE sales SET subtotal=COALESCE((SELECT SUM(line_total) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0),
                        total_amount=COALESCE((SELECT SUM(line_total) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0),
                        customer_payable_amount=CASE WHEN sale_type='INSURANCE' THEN customer_payable_amount ELSE COALESCE((SELECT SUM(line_total) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0) END
       WHERE tenant_id=$1 AND sale_id=$2`,
      [user.tenantId, saleId],
    );
  }

  private async assertRelations(user: AuthUser, siteId: string, currencyId: string, customerId?: string) {
    if (user.siteId && user.siteId !== siteId) throw new Error('SITE_NOT_ALLOWED');
    const r = await this.db.query<{ sites_count: string; currencies_count: string; customers_count: string }>(
      `SELECT
        (SELECT COUNT(*) FROM sites WHERE tenant_id=$1 AND site_id=$2 AND is_active=true)::int AS sites_count,
        (SELECT COUNT(*) FROM currencies WHERE currency_id=$3)::int AS currencies_count,
        (SELECT CASE WHEN $4::uuid IS NULL THEN 1 ELSE COUNT(*) END FROM customers WHERE tenant_id=$1 AND customer_id=$4::uuid)::int AS customers_count`,
      [user.tenantId, siteId, currencyId, customerId ?? null],
    );
    if (Number(r.rows[0]?.sites_count ?? 0) !== 1) throw new Error('SITE_NOT_IN_TENANT');
    if (Number(r.rows[0]?.currencies_count ?? 0) !== 1) throw new Error('CURRENCY_NOT_FOUND');
    if (Number(r.rows[0]?.customers_count ?? 0) !== 1) throw new Error('CUSTOMER_NOT_IN_TENANT');
  }

  private async assertArticle(user: AuthUser, articleId: string) {
    const r = await this.db.query<{ total: string }>(`SELECT COUNT(*)::int AS total FROM articles WHERE tenant_id=$1 AND article_id=$2 AND is_active=true`, [user.tenantId, articleId]);
    if (Number(r.rows[0]?.total ?? 0) !== 1) throw new Error('ARTICLE_NOT_IN_TENANT');
  }

  private toSale(row: SaleRow) { return { saleId: row.sale_id, tenantId: row.tenant_id, saleNumber: row.sale_number, saleDate: row.sale_date, customerId: row.customer_id, customerName: row.customer_name, organizationId: row.organization_id ?? null, membershipId: row.membership_id ?? null, siteId: row.site_id, siteName: row.site_name, currencyId: row.currency_id, exchangeRate: Number(row.exchange_rate), subtotal: Number(row.subtotal), insuranceCoveredAmount: Number(row.insurance_covered_amount ?? 0), customerPayableAmount: Number(row.customer_payable_amount ?? row.total_amount), creditAmount: Number(row.credit_amount ?? 0), totalAmount: Number(row.total_amount), saleType: row.sale_type, status: row.status, createdBy: row.created_by, createdAt: row.created_at, validatedAt: row.validated_at }; }
  private toItem(row: ItemRow) { return { saleItemId: row.sale_item_id, saleId: row.sale_id, articleId: row.article_id, articleCode: row.article_code, commercialName: row.commercial_name, lotId: row.lot_id, lotNumber: row.lot_number, expiryDate: row.expiry_date, quantity: Number(row.quantity), unitPrice: Number(row.unit_price), lineTotal: Number(row.line_total) }; }
}
