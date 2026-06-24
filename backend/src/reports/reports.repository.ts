import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { ReportFilterDto } from './dto/report-filter.dto';

type Scope = { from: string; to: string; siteId: string | null };

@Injectable()
export class ReportsRepository {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const [sales, cash, receivables, stock, expiry, lowStock] = await Promise.all([
      this.salesSummary(user, scope),
      this.cashSummary(user, scope),
      this.receivablesSummary(user, scope),
      this.stockSummary(user, scope),
      this.expirySummary(user, scope),
      this.lowStockCount(user, scope),
    ]);
    return {
      baseCurrency: 'USD',
      currencyCode: 'USD',
      currencySymbol: '$',
      revenueToday: sales.revenueToday,
      revenueMonth: sales.revenueMonth,
      totalCashSales: sales.totalCashSales,
      totalInsuranceSales: sales.totalInsuranceSales,
      totalCashPayments: cash.totalCashPayments,
      openReceivables: receivables.openBalance,
      stockValuePurchase: stock.purchaseValue,
      stockValueSale: stock.saleValue,
      estimatedGrossMargin: stock.saleValue - stock.purchaseValue,
      expiredLotsCount: expiry.expiredLotsCount,
      expiring30DaysCount: expiry.expiring30DaysCount,
      expiring90DaysCount: expiry.expiring90DaysCount,
      lowStockProductsCount: lowStock,
    };
  }

  async sales(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const result = await this.db.query(
      `SELECT s.sale_type AS "saleType", 'USD' AS "baseCurrency", 'USD' AS "currencyCode", '$' AS "currencySymbol", COUNT(*)::int AS count,
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN s.total_amount / NULLIF(s.exchange_rate,0) ELSE s.total_amount END),0)::numeric AS "totalAmount",
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN s.customer_payable_amount / NULLIF(s.exchange_rate,0) ELSE s.customer_payable_amount END),0)::numeric AS "patientAmount",
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN s.insurance_covered_amount / NULLIF(s.exchange_rate,0) ELSE s.insurance_covered_amount END),0)::numeric AS "insuranceAmount"
       FROM sales s
       LEFT JOIN currencies cur ON cur.currency_id=s.currency_id
       WHERE s.tenant_id=$1 AND s.status='VALIDATED'
         AND s.sale_date >= $2::date AND s.sale_date < ($3::date + INTERVAL '1 day')
         AND ($4::uuid IS NULL OR s.site_id=$4::uuid)
       GROUP BY s.sale_type
       ORDER BY s.sale_type`,
      [user.tenantId, scope.from, scope.to, scope.siteId],
    );
    return result.rows.map((row: any) => ({
      ...row,
      totalAmount: Number(row.totalAmount),
      patientAmount: Number(row.patientAmount),
      insuranceAmount: Number(row.insuranceAmount),
    }));
  }

  async stock(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const result = await this.db.query(
      `SELECT a.article_id AS "articleId", a.article_code AS "articleCode", a.commercial_name AS "commercialName",
              SUM(st.quantity_available)::numeric AS "quantityAvailable",
              'USD' AS "baseCurrency", 'USD' AS "currencyCode", '$' AS "currencySymbol",
              SUM(CASE WHEN cur.currency_code='CDF' THEN 0 ELSE st.quantity_available * l.purchase_price END)::numeric AS "purchaseValue",
              SUM(CASE WHEN cur.currency_code='CDF' THEN 0 ELSE st.quantity_available * l.selling_price END)::numeric AS "saleValue",
              MIN(l.expiry_date) AS "nearestExpiryDate"
       FROM stocks st
       JOIN lots l ON l.lot_id=st.lot_id
       LEFT JOIN currencies cur ON cur.currency_id=l.currency_id
       JOIN articles a ON a.article_id=l.article_id
       JOIN sites s ON s.site_id=st.site_id
       WHERE s.tenant_id=$1 AND a.tenant_id=$1
         AND ($2::uuid IS NULL OR st.site_id=$2::uuid)
       GROUP BY a.article_id, a.article_code, a.commercial_name
       ORDER BY "saleValue" DESC, a.commercial_name`,
      [user.tenantId, scope.siteId],
    );
    return result.rows.map((row: any) => ({
      ...row,
      quantityAvailable: Number(row.quantityAvailable),
      purchaseValue: Number(row.purchaseValue),
      saleValue: Number(row.saleValue),
    }));
  }

  async margins(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const result = await this.db.query(
      `SELECT a.article_id AS "articleId", a.article_code AS "articleCode", a.commercial_name AS "commercialName",
              SUM(si.quantity)::numeric AS quantity,
              'USD' AS "baseCurrency", 'USD' AS "currencyCode", '$' AS "currencySymbol",
              SUM(CASE WHEN cur.currency_code='CDF' THEN si.line_total / NULLIF(s.exchange_rate,0) ELSE si.line_total END)::numeric AS revenue,
              SUM(CASE WHEN lot_cur.currency_code='CDF' THEN 0 ELSE si.quantity * l.purchase_price END)::numeric AS "estimatedCost",
              (SUM(CASE WHEN cur.currency_code='CDF' THEN si.line_total / NULLIF(s.exchange_rate,0) ELSE si.line_total END) - SUM(CASE WHEN lot_cur.currency_code='CDF' THEN 0 ELSE si.quantity * l.purchase_price END))::numeric AS "grossMargin"
       FROM sale_items si
       JOIN sales s ON s.sale_id=si.sale_id
       JOIN lots l ON l.lot_id=si.lot_id
       LEFT JOIN currencies cur ON cur.currency_id=s.currency_id
       LEFT JOIN currencies lot_cur ON lot_cur.currency_id=l.currency_id
       JOIN articles a ON a.article_id=si.article_id
       WHERE s.tenant_id=$1 AND s.status='VALIDATED'
         AND s.sale_date >= $2::date AND s.sale_date < ($3::date + INTERVAL '1 day')
         AND ($4::uuid IS NULL OR s.site_id=$4::uuid)
       GROUP BY a.article_id, a.article_code, a.commercial_name
       ORDER BY "grossMargin" DESC`,
      [user.tenantId, scope.from, scope.to, scope.siteId],
    );
    return result.rows.map((row: any) => ({
      ...row,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
      estimatedCost: Number(row.estimatedCost),
      grossMargin: Number(row.grossMargin),
    }));
  }

  async cash(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const result = await this.db.query(
      `SELECT cm.movement_type AS "movementType", 'USD' AS "baseCurrency", 'USD' AS "currencyCode", '$' AS "currencySymbol", COUNT(*)::int AS count,
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN 0 ELSE cm.amount END),0)::numeric AS amount
       FROM cash_movements cm
       JOIN cash_sessions cs ON cs.cash_session_id=cm.cash_session_id AND cs.tenant_id=cm.tenant_id
       LEFT JOIN currencies cur ON cur.currency_id=cm.currency_id
       WHERE cm.tenant_id=$1
         AND cm.movement_date >= $2::date AND cm.movement_date < ($3::date + INTERVAL '1 day')
         AND ($4::uuid IS NULL OR cs.site_id=$4::uuid)
       GROUP BY cm.movement_type
       ORDER BY cm.movement_type`,
      [user.tenantId, scope.from, scope.to, scope.siteId],
    );
    return result.rows.map((row: any) => ({ ...row, amount: Number(row.amount) }));
  }

  async receivables(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const result = await this.db.query(
      `SELECT ar.receivable_type AS "receivableType", ar.status,
              'USD' AS "baseCurrency", 'USD' AS "currencyCode", '$' AS "currencySymbol",
              COUNT(*)::int AS count,
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN ar.amount_due / NULLIF(s.exchange_rate,0) ELSE ar.amount_due END),0)::numeric AS "amountDue",
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN ar.amount_paid / NULLIF(s.exchange_rate,0) ELSE ar.amount_paid END),0)::numeric AS "amountPaid",
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN ar.balance / NULLIF(s.exchange_rate,0) ELSE ar.balance END),0)::numeric AS balance
       FROM accounts_receivable ar
       LEFT JOIN sales s ON s.sale_id=ar.sale_id
       LEFT JOIN currencies cur ON cur.currency_id=ar.currency_id
       WHERE ar.tenant_id=$1
         AND ar.issue_date >= $2::date AND ar.issue_date <= $3::date
         AND ($4::uuid IS NULL OR s.site_id=$4::uuid)
       GROUP BY ar.receivable_type, ar.status
       ORDER BY ar.receivable_type, ar.status`,
      [user.tenantId, scope.from, scope.to, scope.siteId],
    );
    return result.rows.map((row: any) => ({
      ...row,
      amountDue: Number(row.amountDue),
      amountPaid: Number(row.amountPaid),
      balance: Number(row.balance),
    }));
  }

  async expiry(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const result = await this.db.query(
      `SELECT l.lot_id AS "lotId", a.article_code AS "articleCode", a.commercial_name AS "commercialName",
              l.lot_number AS "lotNumber", l.expiry_date AS "expiryDate",
              SUM(st.quantity_available)::numeric AS "quantityAvailable",
              CASE
                WHEN l.expiry_date < CURRENT_DATE THEN 'EXPIRED'
                WHEN l.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_30'
                WHEN l.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'EXPIRING_90'
                ELSE 'OK'
              END AS status
       FROM lots l
       JOIN articles a ON a.article_id=l.article_id
       JOIN stocks st ON st.lot_id=l.lot_id
       JOIN sites s ON s.site_id=st.site_id
       WHERE a.tenant_id=$1 AND s.tenant_id=$1
         AND st.quantity_available > 0
         AND ($2::uuid IS NULL OR st.site_id=$2::uuid)
       GROUP BY l.lot_id, a.article_code, a.commercial_name, l.lot_number, l.expiry_date
       HAVING l.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
       ORDER BY l.expiry_date ASC`,
      [user.tenantId, scope.siteId],
    );
    return result.rows.map((row: any) => ({ ...row, quantityAvailable: Number(row.quantityAvailable) }));
  }

  async topProducts(user: AuthUser, filters: ReportFilterDto) {
    const scope = await this.resolveScope(user, filters);
    const result = await this.db.query(
      `SELECT a.article_id AS "articleId", a.article_code AS "articleCode", a.commercial_name AS "commercialName",
              SUM(si.quantity)::numeric AS quantity,
              'USD' AS "baseCurrency", 'USD' AS "currencyCode", '$' AS "currencySymbol",
              SUM(CASE WHEN cur.currency_code='CDF' THEN si.line_total / NULLIF(s.exchange_rate,0) ELSE si.line_total END)::numeric AS revenue
       FROM sale_items si
       JOIN sales s ON s.sale_id=si.sale_id
       JOIN articles a ON a.article_id=si.article_id
       LEFT JOIN currencies cur ON cur.currency_id=s.currency_id
       WHERE s.tenant_id=$1 AND s.status='VALIDATED'
         AND s.sale_date >= $2::date AND s.sale_date < ($3::date + INTERVAL '1 day')
         AND ($4::uuid IS NULL OR s.site_id=$4::uuid)
       GROUP BY a.article_id, a.article_code, a.commercial_name
       ORDER BY quantity DESC, revenue DESC
       LIMIT 20`,
      [user.tenantId, scope.from, scope.to, scope.siteId],
    );
    return result.rows.map((row: any) => ({ ...row, quantity: Number(row.quantity), revenue: Number(row.revenue) }));
  }

  private async salesSummary(user: AuthUser, scope: Scope) {
    const result = await this.db.query(
      `SELECT
          COALESCE(SUM(CASE WHEN s.sale_date::date = CURRENT_DATE THEN CASE WHEN cur.currency_code='CDF' THEN s.total_amount / NULLIF(s.exchange_rate,0) ELSE s.total_amount END ELSE 0 END),0)::numeric AS "revenueToday",
          COALESCE(SUM(CASE WHEN date_trunc('month', s.sale_date) = date_trunc('month', CURRENT_DATE) THEN CASE WHEN cur.currency_code='CDF' THEN s.total_amount / NULLIF(s.exchange_rate,0) ELSE s.total_amount END ELSE 0 END),0)::numeric AS "revenueMonth",
          COALESCE(SUM(CASE WHEN s.sale_type='CASH' THEN CASE WHEN cur.currency_code='CDF' THEN s.total_amount / NULLIF(s.exchange_rate,0) ELSE s.total_amount END ELSE 0 END),0)::numeric AS "totalCashSales",
          COALESCE(SUM(CASE WHEN s.sale_type='INSURANCE' THEN CASE WHEN cur.currency_code='CDF' THEN s.total_amount / NULLIF(s.exchange_rate,0) ELSE s.total_amount END ELSE 0 END),0)::numeric AS "totalInsuranceSales"
       FROM sales s
       LEFT JOIN currencies cur ON cur.currency_id=s.currency_id
       WHERE s.tenant_id=$1 AND s.status='VALIDATED'
         AND s.sale_date >= $2::date AND s.sale_date < ($3::date + INTERVAL '1 day')
         AND ($4::uuid IS NULL OR s.site_id=$4::uuid)`,
      [user.tenantId, scope.from, scope.to, scope.siteId],
    );
    return this.numbers(result.rows[0], ['revenueToday', 'revenueMonth', 'totalCashSales', 'totalInsuranceSales']);
  }

  private async cashSummary(user: AuthUser, scope: Scope) {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN 0 ELSE cm.amount END),0)::numeric AS "totalCashPayments"
       FROM cash_movements cm
       JOIN cash_sessions cs ON cs.cash_session_id=cm.cash_session_id AND cs.tenant_id=cm.tenant_id
       LEFT JOIN currencies cur ON cur.currency_id=cm.currency_id
       WHERE cm.tenant_id=$1 AND cm.movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','ADVANCE','ADJUSTMENT')
         AND cm.movement_date >= $2::date AND cm.movement_date < ($3::date + INTERVAL '1 day')
         AND ($4::uuid IS NULL OR cs.site_id=$4::uuid)`,
      [user.tenantId, scope.from, scope.to, scope.siteId],
    );
    return this.numbers(result.rows[0], ['totalCashPayments']);
  }

  private async receivablesSummary(user: AuthUser, scope: Scope) {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN ar.balance / NULLIF(s.exchange_rate,0) ELSE ar.balance END),0)::numeric AS "openBalance"
       FROM accounts_receivable ar
       LEFT JOIN sales s ON s.sale_id=ar.sale_id
       LEFT JOIN currencies cur ON cur.currency_id=ar.currency_id
       WHERE ar.tenant_id=$1 AND ar.status IN ('OPEN','PARTIALLY_PAID','OVERDUE')
         AND ($2::uuid IS NULL OR s.site_id=$2::uuid)`,
      [user.tenantId, scope.siteId],
    );
    return this.numbers(result.rows[0], ['openBalance']);
  }

  private async stockSummary(user: AuthUser, scope: Scope) {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN 0 ELSE st.quantity_available * l.purchase_price END),0)::numeric AS "purchaseValue",
              COALESCE(SUM(CASE WHEN cur.currency_code='CDF' THEN 0 ELSE st.quantity_available * l.selling_price END),0)::numeric AS "saleValue"
       FROM stocks st
       JOIN lots l ON l.lot_id=st.lot_id
       LEFT JOIN currencies cur ON cur.currency_id=l.currency_id
       JOIN articles a ON a.article_id=l.article_id
       JOIN sites s ON s.site_id=st.site_id
       WHERE a.tenant_id=$1 AND s.tenant_id=$1
         AND ($2::uuid IS NULL OR st.site_id=$2::uuid)`,
      [user.tenantId, scope.siteId],
    );
    return this.numbers(result.rows[0], ['purchaseValue', 'saleValue']);
  }

  private async expirySummary(user: AuthUser, scope: Scope) {
    const result = await this.db.query(
      `SELECT
          COUNT(DISTINCT CASE WHEN l.expiry_date < CURRENT_DATE THEN l.lot_id END)::int AS "expiredLotsCount",
          COUNT(DISTINCT CASE WHEN l.expiry_date >= CURRENT_DATE AND l.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN l.lot_id END)::int AS "expiring30DaysCount",
          COUNT(DISTINCT CASE WHEN l.expiry_date > CURRENT_DATE + INTERVAL '30 days' AND l.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN l.lot_id END)::int AS "expiring90DaysCount"
       FROM lots l
       JOIN articles a ON a.article_id=l.article_id
       JOIN stocks st ON st.lot_id=l.lot_id
       JOIN sites s ON s.site_id=st.site_id
       WHERE a.tenant_id=$1 AND s.tenant_id=$1
         AND st.quantity_available > 0
         AND ($2::uuid IS NULL OR st.site_id=$2::uuid)`,
      [user.tenantId, scope.siteId],
    );
    return this.numbers(result.rows[0], ['expiredLotsCount', 'expiring30DaysCount', 'expiring90DaysCount']);
  }

  private async lowStockCount(user: AuthUser, scope: Scope) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS total
       FROM (
         SELECT a.article_id, SUM(st.quantity_available)::numeric AS qty, COALESCE(NULLIF(MAX(a.default_stock_min),0), MAX(st.stock_min), 0)::numeric AS min_qty
         FROM articles a
         JOIN lots l ON l.article_id=a.article_id
         JOIN stocks st ON st.lot_id=l.lot_id
         JOIN sites s ON s.site_id=st.site_id
         WHERE a.tenant_id=$1 AND s.tenant_id=$1
           AND ($2::uuid IS NULL OR st.site_id=$2::uuid)
         GROUP BY a.article_id
       ) q
       WHERE q.min_qty > 0 AND q.qty <= q.min_qty`,
      [user.tenantId, scope.siteId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  private async resolveScope(user: AuthUser, filters: ReportFilterDto): Promise<Scope> {
    const siteId = user.siteId ?? filters.siteId ?? null;
    if (filters.siteId) await this.assertSiteAllowed(user, filters.siteId);
    return {
      from: filters.from ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
      to: filters.to ?? new Date().toISOString().slice(0, 10),
      siteId,
    };
  }

  private async assertSiteAllowed(user: AuthUser, siteId: string) {
    if (user.siteId && user.siteId !== siteId) throw new Error('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM sites WHERE tenant_id=$1 AND site_id=$2 AND is_active=true`,
      [user.tenantId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('SITE_NOT_IN_TENANT');
  }

  private numbers(row: any, keys: string[]) {
    const out = { ...(row ?? {}) };
    for (const key of keys) out[key] = Number(out[key] ?? 0);
    return out;
  }
}
