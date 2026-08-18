import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AccountingRepository } from '../accounting/accounting.repository';
import { DatabaseService } from '../database/database.service';
import { SubmitPosSaleValidateOperation } from '../pos-sync/dto/submit-pos-operations.dto';
import { AddSaleItemFefoDto } from './dto/add-sale-item-fefo.dto';
import { ApplyInsuranceDto } from './dto/apply-insurance.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import { UpdateSaleDraftDto } from './dto/update-sale-draft.dto';
import { ValidateSaleDto } from './dto/validate-sale.dto';

const SETTLEMENT_TOLERANCE_USD = 0.02;

type SaleRow = { sale_id: string; tenant_id: string; sale_number: string; sale_date: Date; customer_id: string | null; customer_name: string | null; organization_id?: string | null; organization_name?: string | null; membership_id?: string | null; plan_name?: string | null; coverage_percent?: string | null; site_id: string; site_name: string | null; currency_id: string; currency_code: string | null; currency_symbol: string | null; exchange_rate: string; subtotal: string; discount_amount?: string; insurance_covered_amount?: string; customer_payable_amount?: string; credit_amount?: string; total_amount: string; amount_paid_usd?: string; amount_paid_cdf?: string; amount_returned_usd?: string; amount_returned_cdf?: string; net_received_usd?: string; net_received_cdf?: string; settlement_difference_usd?: string; settlement_difference_type?: string | null; settlement_difference_reason?: string | null; settlement_difference_note?: string | null; sale_type: string; sale_mode: string; fulfillment_status: string; fulfilled_at: Date | null; pickup_token: string | null; pickup_number: string | null; pickup_site_id: string | null; expected_pickup_date: Date | null; last_fulfillment_at: Date | null; status: string; created_by: string | null; created_at: Date; validated_at: Date | null };
type ItemRow = { sale_item_id: string; tenant_id: string; sale_id: string; article_id: string; article_code: string | null; commercial_name: string | null; lot_id: string | null; lot_number: string | null; expiry_date: string | Date | null; quantity: string; ordered_quantity?: string; fulfilled_quantity?: string; unit_price: string; line_total: string; sales_unit_snapshot?: string | null; packaging_snapshot?: string | null; coverage_percent?: string | null; covered_amount?: string | null; patient_amount?: string | null };
type SettlementSnapshot = {
  amountPaidUsd: number;
  amountPaidCdf: number;
  amountReturnedUsd: number;
  amountReturnedCdf: number;
  netReceivedUsd: number;
  netReceivedCdf: number;
  netTotalEquivalentUsd: number;
  settlementDifferenceUsd: number;
  settlementDifferenceType: string;
  settlementDifferenceReason: string | null;
  settlementDifferenceNote: string | null;
};
type SaleListRow = SaleRow & {
  created_by_name: string | null;
  payment_modes: string | null;
  total_count: string;
};

type Queryable = {
  query: DatabaseService['query'];
};

type OfflineAllocationLockRow = {
  allocation_id: string;
  workstation_id: string;
  site_id: string;
  article_id: string;
  lot_id: string;
  allocated_quantity: string;
  consumed_quantity: string;
  status: string;
  server_version: string;
};

type FinalizeSaleOptions = {
  effectiveValidationDate?: string | null;
  enforceOfflineReservations?: boolean;
  lotExpiredErrorCode?: string;
  lotBlockedErrorCode?: string;
  cashSessionMissingErrorCode?: string;
  validatedAt?: string | null;
};

type OfflineReplayAllocationAck = {
  allocationId: string;
  lotId: string;
  acknowledgedQuantity: number;
  serverConsumedQuantity: number;
  availableQuantity: number;
  serverVersion: number;
  status: string;
};

@Injectable()
export class SalesRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly accounting: AccountingRepository,
  ) {}

  async findAll(user: AuthUser) {
    const r = await this.db.query<SaleRow>(
      `SELECT s.sale_id, s.tenant_id, s.sale_number, s.sale_date, s.customer_id, c.customer_name,
              s.organization_id, o.organization_name, s.membership_id, ip.plan_name, ip.coverage_percent,
              s.site_id, st.site_name, s.currency_id, cur.currency_code,
              CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS currency_symbol,
              s.exchange_rate, s.subtotal, s.discount_amount,
              s.insurance_covered_amount, s.customer_payable_amount, s.credit_amount, s.total_amount,
              s.amount_paid_usd, s.amount_paid_cdf, s.amount_returned_usd, s.amount_returned_cdf,
              s.net_received_usd, s.net_received_cdf, s.settlement_difference_usd,
              s.settlement_difference_type, s.settlement_difference_reason, s.settlement_difference_note,
              s.sale_type, s.sale_mode, s.fulfillment_status, s.fulfilled_at, s.pickup_token, s.pickup_number,
              s.pickup_site_id, s.expected_pickup_date, s.last_fulfillment_at,
              s.status, s.created_by, s.created_at, s.validated_at
       FROM sales s
       JOIN sites st ON st.site_id=s.site_id AND st.tenant_id=s.tenant_id
       LEFT JOIN currencies cur ON cur.currency_id=s.currency_id
       LEFT JOIN customers c ON c.customer_id=s.customer_id AND c.tenant_id=s.tenant_id
       LEFT JOIN organizations o ON o.organization_id=s.organization_id AND o.tenant_id=s.tenant_id
       LEFT JOIN customer_memberships cm ON cm.membership_id=s.membership_id AND cm.tenant_id=s.tenant_id
       LEFT JOIN insurance_plans ip ON ip.plan_id=cm.plan_id
       WHERE s.tenant_id=$1
         AND ($2::uuid IS NULL OR s.site_id=$2::uuid)
       ORDER BY s.sale_date DESC`,
      [user.tenantId, user.siteId ?? null],
    );
    return r.rows.map(this.toSale);
  }

  async findList(user: AuthUser, query: ListSalesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const built = this.buildListFilterSql(user, query);
    const sortColumn = this.resolveListSort(query.sortBy);
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const params = [...built.params, limit, offset];
    const rows = await this.db.query<SaleListRow>(
      `
      WITH filtered_sales AS (
        SELECT
          s.sale_id, s.tenant_id, s.sale_number, s.sale_date, s.customer_id, c.customer_name,
          s.organization_id, o.organization_name, s.membership_id, ip.plan_name, ip.coverage_percent,
          s.site_id, st.site_name, s.currency_id, cur.currency_code,
          CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS currency_symbol,
          s.exchange_rate, s.subtotal, s.discount_amount,
          s.insurance_covered_amount, s.customer_payable_amount, s.credit_amount, s.total_amount,
          s.amount_paid_usd, s.amount_paid_cdf, s.amount_returned_usd, s.amount_returned_cdf,
          s.net_received_usd, s.net_received_cdf, s.settlement_difference_usd,
          s.settlement_difference_type, s.settlement_difference_reason, s.settlement_difference_note,
          s.sale_type, s.sale_mode, s.fulfillment_status, s.fulfilled_at, s.pickup_token, s.pickup_number,
          s.pickup_site_id, s.expected_pickup_date, s.last_fulfillment_at,
          s.status, s.created_by, s.created_at, s.validated_at,
          u.full_name AS created_by_name
        FROM sales s
        JOIN sites st ON st.site_id=s.site_id AND st.tenant_id=s.tenant_id
        LEFT JOIN currencies cur ON cur.currency_id=s.currency_id
        LEFT JOIN customers c ON c.customer_id=s.customer_id AND c.tenant_id=s.tenant_id
        LEFT JOIN organizations o ON o.organization_id=s.organization_id AND o.tenant_id=s.tenant_id
        LEFT JOIN customer_memberships cm ON cm.membership_id=s.membership_id AND cm.tenant_id=s.tenant_id
        LEFT JOIN insurance_plans ip ON ip.plan_id=cm.plan_id
        LEFT JOIN users u ON u.user_id=s.created_by AND u.tenant_id=s.tenant_id
        WHERE ${built.where}
      )
      SELECT
        filtered_sales.*,
        payment_modes.methods AS payment_modes,
        COUNT(*) OVER()::int AS total_count
      FROM filtered_sales
      LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT COALESCE(pm.method_name, pm.method_code), ', ' ORDER BY COALESCE(pm.method_name, pm.method_code)) AS methods
        FROM payments p
        JOIN payment_methods pm ON pm.payment_method_id = p.payment_method_id
        WHERE p.tenant_id = filtered_sales.tenant_id
          AND p.sale_id = filtered_sales.sale_id
      ) AS payment_modes ON true
      ORDER BY ${sortColumn} ${sortOrder}, filtered_sales.created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
      `,
      params,
    );

    return {
      items: rows.rows.map((row) => ({
        ...this.toSale(row),
        createdByName: row.created_by_name,
        paymentModes: row.payment_modes ?? '-',
      })),
      page,
      limit,
      total: Number(rows.rows[0]?.total_count ?? 0),
      totalPages: Math.max(1, Math.ceil(Number(rows.rows[0]?.total_count ?? 0) / limit)),
    };
  }

  async findSummary(user: AuthUser, query: ListSalesDto) {
    const built = this.buildListFilterSql(user, query);
    const summary = await this.db.query<{
      revenue_net: string;
      sale_count: string;
      immediate_sale_count: string;
      advance_sale_count: string;
      advance_fulfilled_count: string;
      advance_pending_count: string;
      immediate_revenue: string;
      advance_fulfilled_revenue: string;
      advance_pending_revenue: string;
      average_basket: string;
      received_usd: string;
      received_cdf: string;
      change_usd: string;
      change_cdf: string;
      settlement_difference_usd: string;
      settlement_difference_count: string;
      cancelled_count: string;
    }>(
      `
      WITH filtered_sales AS (
        SELECT
          s.sale_id,
          s.tenant_id,
          s.status,
          s.sale_mode,
          s.fulfillment_status,
          s.total_amount,
          s.net_received_usd,
          s.net_received_cdf,
          s.amount_returned_usd,
          s.amount_returned_cdf,
          s.settlement_difference_usd
        FROM sales s
        JOIN sites st ON st.site_id=s.site_id AND st.tenant_id=s.tenant_id
        LEFT JOIN customers c ON c.customer_id=s.customer_id AND c.tenant_id=s.tenant_id
        LEFT JOIN organizations o ON o.organization_id=s.organization_id AND o.tenant_id=s.tenant_id
        LEFT JOIN customer_memberships cm ON cm.membership_id=s.membership_id AND cm.tenant_id=s.tenant_id
        LEFT JOIN insurance_plans ip ON ip.plan_id=cm.plan_id
        LEFT JOIN users u ON u.user_id=s.created_by AND u.tenant_id=s.tenant_id
        WHERE ${built.where}
      ),
      items_summary AS (
        SELECT COALESCE(SUM(si.quantity), 0)::numeric AS items_sold
        FROM filtered_sales fs
        JOIN sale_items si ON si.sale_id = fs.sale_id AND si.tenant_id = fs.tenant_id
        WHERE fs.status = 'VALIDATED'
      )
      SELECT
        COALESCE(SUM(CASE WHEN status='VALIDATED' THEN total_amount ELSE 0 END), 0)::numeric AS revenue_net,
        COUNT(*) FILTER (WHERE status='VALIDATED')::int AS sale_count,
        COUNT(*) FILTER (WHERE status='VALIDATED' AND sale_mode='IMMEDIATE')::int AS immediate_sale_count,
        COUNT(*) FILTER (WHERE status='VALIDATED' AND sale_mode='ADVANCE')::int AS advance_sale_count,
        COUNT(*) FILTER (WHERE status='VALIDATED' AND sale_mode='ADVANCE' AND fulfillment_status='FULFILLED')::int AS advance_fulfilled_count,
        COUNT(*) FILTER (WHERE status='VALIDATED' AND sale_mode='ADVANCE' AND fulfillment_status<>'FULFILLED')::int AS advance_pending_count,
        COALESCE(SUM(CASE WHEN status='VALIDATED' AND sale_mode='IMMEDIATE' THEN total_amount ELSE 0 END), 0)::numeric AS immediate_revenue,
        COALESCE(SUM(CASE WHEN status='VALIDATED' AND sale_mode='ADVANCE' AND fulfillment_status='FULFILLED' THEN total_amount ELSE 0 END), 0)::numeric AS advance_fulfilled_revenue,
        COALESCE(SUM(CASE WHEN status='VALIDATED' AND sale_mode='ADVANCE' AND fulfillment_status<>'FULFILLED' THEN total_amount ELSE 0 END), 0)::numeric AS advance_pending_revenue,
        CASE
          WHEN COUNT(*) FILTER (WHERE status='VALIDATED') = 0 THEN 0
          ELSE ROUND(
            COALESCE(SUM(CASE WHEN status='VALIDATED' THEN total_amount ELSE 0 END), 0)
            / COUNT(*) FILTER (WHERE status='VALIDATED'),
            2
          )
        END::numeric AS average_basket,
        COALESCE(SUM(CASE WHEN status='VALIDATED' THEN net_received_usd ELSE 0 END), 0)::numeric AS received_usd,
        COALESCE(SUM(CASE WHEN status='VALIDATED' THEN net_received_cdf ELSE 0 END), 0)::numeric AS received_cdf,
        COALESCE(SUM(CASE WHEN status='VALIDATED' THEN amount_returned_usd ELSE 0 END), 0)::numeric AS change_usd,
        COALESCE(SUM(CASE WHEN status='VALIDATED' THEN amount_returned_cdf ELSE 0 END), 0)::numeric AS change_cdf,
        COALESCE(SUM(CASE WHEN status='VALIDATED' THEN settlement_difference_usd ELSE 0 END), 0)::numeric AS settlement_difference_usd,
        COUNT(*) FILTER (WHERE status='VALIDATED' AND COALESCE(settlement_difference_usd, 0) <> 0)::int AS settlement_difference_count,
        COUNT(*) FILTER (WHERE status='CANCELLED')::int AS cancelled_count
      FROM filtered_sales
      `,
      built.params,
    );
    const itemsSummary = await this.db.query<{ items_sold: string }>(
      `
      WITH filtered_sales AS (
        SELECT s.sale_id, s.tenant_id, s.status
        FROM sales s
        JOIN sites st ON st.site_id=s.site_id AND st.tenant_id=s.tenant_id
        LEFT JOIN customers c ON c.customer_id=s.customer_id AND c.tenant_id=s.tenant_id
        LEFT JOIN organizations o ON o.organization_id=s.organization_id AND o.tenant_id=s.tenant_id
        LEFT JOIN customer_memberships cm ON cm.membership_id=s.membership_id AND cm.tenant_id=s.tenant_id
        LEFT JOIN insurance_plans ip ON ip.plan_id=cm.plan_id
        LEFT JOIN users u ON u.user_id=s.created_by AND u.tenant_id=s.tenant_id
        WHERE ${built.where}
      )
      SELECT COALESCE(SUM(si.quantity), 0)::numeric AS items_sold
      FROM filtered_sales fs
      JOIN sale_items si ON si.sale_id = fs.sale_id AND si.tenant_id = fs.tenant_id
      WHERE fs.status = 'VALIDATED'
      `,
      built.params,
    );

    const row = summary.rows[0];
    return {
      revenueNet: Number(row?.revenue_net ?? 0),
      saleCount: Number(row?.sale_count ?? 0),
      immediateSaleCount: Number(row?.immediate_sale_count ?? 0),
      advanceSaleCount: Number(row?.advance_sale_count ?? 0),
      advanceFulfilledCount: Number(row?.advance_fulfilled_count ?? 0),
      advancePendingCount: Number(row?.advance_pending_count ?? 0),
      immediateRevenue: Number(row?.immediate_revenue ?? 0),
      advanceFulfilledRevenue: Number(row?.advance_fulfilled_revenue ?? 0),
      advancePendingRevenue: Number(row?.advance_pending_revenue ?? 0),
      averageBasket: Number(row?.average_basket ?? 0),
      itemsSold: Number(itemsSummary.rows[0]?.items_sold ?? 0),
      receivedUsd: Number(row?.received_usd ?? 0),
      receivedCdf: Number(row?.received_cdf ?? 0),
      changeUsd: Number(row?.change_usd ?? 0),
      changeCdf: Number(row?.change_cdf ?? 0),
      settlementDifferenceUsd: Number(row?.settlement_difference_usd ?? 0),
      settlementDifferenceCount: Number(row?.settlement_difference_count ?? 0),
      cancelledCount: Number(row?.cancelled_count ?? 0),
    };
  }

  async findOne(user: AuthUser, id: string) {
    const r = await this.db.query<SaleRow>(
      `SELECT s.sale_id, s.tenant_id, s.sale_number, s.sale_date, s.customer_id, c.customer_name,
              s.organization_id, o.organization_name, s.membership_id, ip.plan_name, ip.coverage_percent,
              s.site_id, st.site_name, s.currency_id, cur.currency_code,
              CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS currency_symbol,
              s.exchange_rate, s.subtotal, s.discount_amount,
              s.insurance_covered_amount, s.customer_payable_amount, s.credit_amount, s.total_amount,
              s.amount_paid_usd, s.amount_paid_cdf, s.amount_returned_usd, s.amount_returned_cdf,
              s.net_received_usd, s.net_received_cdf, s.settlement_difference_usd,
              s.settlement_difference_type, s.settlement_difference_reason, s.settlement_difference_note,
              s.sale_type, s.sale_mode, s.fulfillment_status, s.fulfilled_at, s.pickup_token, s.pickup_number,
              s.pickup_site_id, s.expected_pickup_date, s.last_fulfillment_at,
              s.status, s.created_by, s.created_at, s.validated_at
       FROM sales s
       JOIN sites st ON st.site_id=s.site_id AND st.tenant_id=s.tenant_id
       LEFT JOIN currencies cur ON cur.currency_id=s.currency_id
       LEFT JOIN customers c ON c.customer_id=s.customer_id AND c.tenant_id=s.tenant_id
       LEFT JOIN organizations o ON o.organization_id=s.organization_id AND o.tenant_id=s.tenant_id
       LEFT JOIN customer_memberships cm ON cm.membership_id=s.membership_id AND cm.tenant_id=s.tenant_id
       LEFT JOIN insurance_plans ip ON ip.plan_id=cm.plan_id
       WHERE s.tenant_id=$1 AND s.sale_id=$2
         AND ($3::uuid IS NULL OR s.site_id=$3::uuid)
       LIMIT 1`,
      [user.tenantId, id, user.siteId ?? null],
    );
    if (!r.rows[0]) return null;
    return { ...this.toSale(r.rows[0]), items: await this.findItems(user, id), payments: await this.findPayments(user, id) };
  }

  async create(user: AuthUser, dto: CreateSaleDto) {
    const currencyId = dto.currencyId ?? await this.defaultCurrencyId();
    await this.assertRelations(user, dto.siteId, currencyId, dto.customerId, dto.exchangeRate);
    const number = `SAL-${Date.now()}`;
    const saleMode = dto.saleMode ?? 'IMMEDIATE';
    const fulfillmentStatus = saleMode === 'ADVANCE' ? 'NOT_FULFILLED' : 'FULFILLED';
    const r = await this.db.query<SaleRow>(
      `INSERT INTO sales (tenant_id, sale_number, site_id, customer_id, currency_id, exchange_rate, sale_type, sale_mode, fulfillment_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$8,$7,$9,$10,$6)
       RETURNING sale_id, tenant_id, sale_number, sale_date, customer_id, NULL::text AS customer_name, organization_id, membership_id, site_id, NULL::text AS site_name, currency_id, NULL::text AS currency_code, NULL::text AS currency_symbol, exchange_rate, subtotal, insurance_covered_amount, customer_payable_amount, credit_amount, total_amount, amount_paid_usd, amount_paid_cdf, amount_returned_usd, amount_returned_cdf, net_received_usd, net_received_cdf, settlement_difference_usd, settlement_difference_type, settlement_difference_reason, settlement_difference_note, sale_type, sale_mode, fulfillment_status, fulfilled_at, pickup_token, pickup_number, pickup_site_id, expected_pickup_date, last_fulfillment_at, status, created_by, created_at, validated_at`,
      [user.tenantId, number, dto.siteId, dto.customerId ?? null, currencyId, user.userId, dto.saleType ?? 'CASH', dto.exchangeRate ?? 1, saleMode, fulfillmentStatus],
    );
    return this.findOne(user, r.rows[0].sale_id);
  }

  async updateDraft(user: AuthUser, saleId: string, dto: UpdateSaleDraftDto) {
    const sale = await this.findOne(user, saleId);
    if (!sale) return null;
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');

    const nextSaleType = dto.saleType ?? sale.saleType;
    const nextSaleMode = dto.saleMode ?? sale.saleMode ?? 'IMMEDIATE';
    const nextCustomerId = dto.customerId === undefined ? sale.customerId : dto.customerId;
    if (nextSaleType === 'INSURANCE' && !nextCustomerId) throw new Error('CUSTOMER_REQUIRED_FOR_INSURANCE');
    if (nextCustomerId) await this.assertCustomer(user, nextCustomerId);

    await this.db.query(
      `UPDATE sales
       SET customer_id=$3,
           sale_type=$4,
           sale_mode=$5,
           fulfillment_status=CASE WHEN $5='ADVANCE' THEN 'NOT_FULFILLED' ELSE fulfillment_status END,
           organization_id=NULL,
           membership_id=NULL,
           insurance_covered_amount=0,
           credit_amount=0,
           customer_payable_amount=total_amount
       WHERE tenant_id=$1 AND sale_id=$2`,
      [user.tenantId, saleId, nextCustomerId ?? null, nextSaleType, nextSaleMode],
    );
    await this.db.query(
      `UPDATE sale_items
       SET coverage_percent=0,
           covered_amount=0,
           patient_amount=line_total
       WHERE tenant_id=$1 AND sale_id=$2`,
      [user.tenantId, saleId],
    );
    return this.findOne(user, saleId);
  }

  async addItemFefo(user: AuthUser, saleId: string, dto: AddSaleItemFefoDto) {
    const sale = await this.findOne(user, saleId);
    if (!sale) return null;
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');
    await this.assertArticle(user, dto.articleId);
    if ((sale.saleMode ?? 'IMMEDIATE') === 'ADVANCE') {
      const priceRows = await this.db.query<{ selling_price: string | null }>(
        `SELECT COALESCE(MIN(l.selling_price), 0)::numeric AS selling_price
         FROM lots l
         WHERE l.tenant_id=$1 AND l.article_id=$2`,
        [user.tenantId, dto.articleId],
      );
      const unitPrice = Number(priceRows.rows[0]?.selling_price ?? 0);
      const existing = await this.db.query<{ sale_item_id: string; quantity: string; ordered_quantity: string; fulfilled_quantity: string }>(
        `SELECT sale_item_id, quantity, ordered_quantity, fulfilled_quantity
         FROM sale_items
         WHERE tenant_id=$1 AND sale_id=$2 AND article_id=$3 AND lot_id IS NULL
         ORDER BY sale_item_id`,
        [user.tenantId, saleId, dto.articleId],
      );
      const existingQuantity = existing.rows.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
      const nextQuantity = this.roundMoney(existingQuantity + dto.quantity);
      const lineTotal = this.roundMoney(nextQuantity * unitPrice);
      const saleCoveragePercent = sale.saleType === 'INSURANCE' ? Number(sale.coveragePercent ?? 0) : 0;
      const coveredAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal * saleCoveragePercent / 100) : 0;
      const patientAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal - coveredAmount) : lineTotal;
      if (existing.rows[0]) {
        await this.db.query(
          `UPDATE sale_items
           SET quantity=$5,
               ordered_quantity=$5,
               fulfilled_quantity=COALESCE(fulfilled_quantity, 0),
               unit_price=$6,
               coverage_percent=$7,
               covered_amount=$8,
               patient_amount=$9,
               line_total=$10
           WHERE tenant_id=$1 AND sale_id=$2 AND sale_item_id=$3 AND article_id=$4 AND lot_id IS NULL`,
          [user.tenantId, saleId, existing.rows[0].sale_item_id, dto.articleId, nextQuantity, unitPrice, saleCoveragePercent, coveredAmount, patientAmount, lineTotal],
        );
      } else {
        await this.db.query(
          `INSERT INTO sale_items (
             tenant_id, sale_id, article_id, lot_id, quantity, ordered_quantity, fulfilled_quantity,
             unit_price, sales_unit_snapshot, packaging_snapshot, coverage_percent, covered_amount,
             patient_amount, line_total
           )
           VALUES ($1,$2,$3,NULL,$4,$5,0,$6,NULL,NULL,$7,$8,$9,$10)`,
          [user.tenantId, saleId, dto.articleId, dto.quantity, dto.quantity, unitPrice, saleCoveragePercent, coveredAmount, patientAmount, lineTotal],
        );
      }
      await this.recalculateTotal(user, saleId, sale.saleType);
      return this.findOne(user, saleId);
    }
    const saleCoveragePercent = sale.saleType === 'INSURANCE' ? Number(sale.coveragePercent ?? 0) : 0;

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
      const reservedQuantity = await this.getOfflineReservedQuantity(this.db as unknown as Queryable, user.tenantId, sale.siteId, lot.lot_id);
      const existing = await this.db.query<{ sale_item_id: string; quantity: string }>(
        `SELECT sale_item_id, quantity
         FROM sale_items
         WHERE tenant_id=$1 AND sale_id=$2 AND article_id=$3 AND lot_id=$4
         ORDER BY sale_item_id`,
        [user.tenantId, saleId, dto.articleId, lot.lot_id],
      );
      const existingQuantity = existing.rows.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
      const stillAvailable = Math.max(0, Number(lot.quantity_available) - reservedQuantity) - existingQuantity;
      if (stillAvailable <= 0) continue;

      const take = Math.min(remaining, stillAvailable);
      const price = Number(lot.selling_price);
      const lineTotal = this.roundMoney(take * price);
      const coveredAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal * saleCoveragePercent / 100) : 0;
      const patientAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal - coveredAmount) : lineTotal;
      if (existing.rows[0]) {
        const nextQuantity = existingQuantity + take;
        const nextLineTotal = this.roundMoney(nextQuantity * price);
        const nextCoveredAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(nextLineTotal * saleCoveragePercent / 100) : 0;
        const nextPatientAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(nextLineTotal - nextCoveredAmount) : nextLineTotal;
        await this.db.query(
          `UPDATE sale_items
           SET quantity=$5,
               ordered_quantity=$5,
               fulfilled_quantity=$5,
               unit_price=$6,
               coverage_percent=$7,
               covered_amount=$8,
               patient_amount=$9,
               line_total=$10
           WHERE tenant_id=$1 AND sale_id=$2 AND sale_item_id=$3 AND lot_id=$4`,
          [user.tenantId, saleId, existing.rows[0].sale_item_id, lot.lot_id, nextQuantity, price, saleCoveragePercent, nextCoveredAmount, nextPatientAmount, nextLineTotal],
        );
        if (existing.rows.length > 1) {
          await this.db.query(
            `DELETE FROM sale_items
             WHERE tenant_id=$1 AND sale_id=$2 AND lot_id=$3 AND article_id=$4 AND sale_item_id <> $5`,
            [user.tenantId, saleId, lot.lot_id, dto.articleId, existing.rows[0].sale_item_id],
          );
        }
      } else {
        await this.db.query(
          `INSERT INTO sale_items (tenant_id, sale_id, article_id, lot_id, quantity, ordered_quantity, fulfilled_quantity, unit_price, coverage_percent, covered_amount, patient_amount, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [user.tenantId, saleId, dto.articleId, lot.lot_id, take, take, take, price, saleCoveragePercent, coveredAmount, patientAmount, lineTotal],
        );
      }
      remaining -= take;
    }
    if (remaining > 0) throw new Error('STOCK_INSUFFICIENT');
    await this.recalculateTotal(user, saleId, sale.saleType);
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
    await this.recalculateTotal(user, saleId, sale.saleType);
    return this.findOne(user, saleId);
  }

  async updateItem(user: AuthUser, saleId: string, itemId: string, dto: { quantity: number }) {
    const sale = await this.findOne(user, saleId);
    if (!sale) return null;
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');

    if ((sale.saleMode ?? 'IMMEDIATE') === 'ADVANCE') {
      const result = await this.db.query<{
        sale_item_id: string;
        article_id: string;
        quantity: string;
        ordered_quantity: string;
        fulfilled_quantity: string;
        unit_price: string;
        coverage_percent: string | null;
      }>(
        `SELECT si.sale_item_id, si.article_id, si.quantity, si.ordered_quantity, si.fulfilled_quantity, si.unit_price, COALESCE(si.coverage_percent, 0) AS coverage_percent
         FROM sale_items si
         WHERE si.tenant_id=$1 AND si.sale_id=$2 AND si.sale_item_id=$3
         LIMIT 1`,
        [user.tenantId, saleId, itemId],
      );
      const current = result.rows[0];
      if (!current) throw new Error('SALE_ITEM_NOT_FOUND');

      const quantity = Number(dto.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('INVALID_SALE_ITEM_QUANTITY');

      const unitPrice = Number(current.unit_price);
      const lineTotal = this.roundMoney(quantity * unitPrice);
      const coveragePercent = sale.saleType === 'INSURANCE' ? Number(current.coverage_percent ?? sale.coveragePercent ?? 0) : 0;
      const coveredAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal * coveragePercent / 100) : 0;
      const patientAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal - coveredAmount) : lineTotal;

      await this.db.query(
        `UPDATE sale_items
         SET quantity=$4,
             ordered_quantity=$4,
             unit_price=$5,
             coverage_percent=$6,
             covered_amount=$7,
             patient_amount=$8,
             line_total=$9
         WHERE tenant_id=$1 AND sale_id=$2 AND sale_item_id=$3`,
        [user.tenantId, saleId, itemId, quantity, unitPrice, coveragePercent, coveredAmount, patientAmount, lineTotal],
      );
      await this.recalculateTotal(user, saleId, sale.saleType);
      return this.findOne(user, saleId);
    }

    const result = await this.db.query<{
      sale_item_id: string;
      article_id: string;
      lot_id: string;
      quantity: string;
      unit_price: string;
      coverage_percent: string | null;
    }>(
      `SELECT si.sale_item_id, si.article_id, si.lot_id, si.quantity, si.unit_price, COALESCE(si.coverage_percent, 0) AS coverage_percent
       FROM sale_items si
       WHERE si.tenant_id=$1 AND si.sale_id=$2 AND si.sale_item_id=$3
       LIMIT 1`,
      [user.tenantId, saleId, itemId],
    );
    const current = result.rows[0];
    if (!current) throw new Error('SALE_ITEM_NOT_FOUND');

    const quantity = Number(dto.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('INVALID_SALE_ITEM_QUANTITY');

    const stock = await this.db.query<{ quantity_available: string; expiry_date: string | Date; is_expired: boolean; is_blocked: boolean }>(
      `SELECT st.quantity_available, l.expiry_date, (l.expiry_date <= CURRENT_DATE) AS is_expired, l.is_blocked
       FROM stocks st
       JOIN lots l ON l.lot_id=st.lot_id AND l.tenant_id=st.tenant_id
       WHERE st.tenant_id=$1 AND st.site_id=$2 AND st.lot_id=$3
       LIMIT 1`,
      [user.tenantId, sale.siteId, current.lot_id],
    );
    const row = stock.rows[0];
    if (!row) throw new Error('STOCK_INSUFFICIENT');
    const expiryDate = this.toCivilDateString(row.expiry_date);
    if (!expiryDate) throw new Error('LOT_EXPIRY_DATE_INVALID');
    if (row.is_expired || expiryDate <= this.todayCivilDate()) throw new Error('LOT_EXPIRED');
    if (row.is_blocked) throw new Error('LOT_BLOCKED');
    if (quantity > Number(row.quantity_available)) throw new Error('STOCK_INSUFFICIENT');

    const unitPrice = Number(current.unit_price);
    const lineTotal = this.roundMoney(quantity * unitPrice);
    const coveragePercent = sale.saleType === 'INSURANCE' ? Number(current.coverage_percent ?? sale.coveragePercent ?? 0) : 0;
    const coveredAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal * coveragePercent / 100) : 0;
    const patientAmount = sale.saleType === 'INSURANCE' ? this.roundMoney(lineTotal - coveredAmount) : lineTotal;

    await this.db.query(
      `UPDATE sale_items
       SET quantity=$4,
           unit_price=$5,
           coverage_percent=$6,
           covered_amount=$7,
           patient_amount=$8,
           line_total=$9
       WHERE tenant_id=$1 AND sale_id=$2 AND sale_item_id=$3`,
      [user.tenantId, saleId, itemId, quantity, unitPrice, coveragePercent, coveredAmount, patientAmount, lineTotal],
    );
    await this.recalculateTotal(user, saleId, sale.saleType);
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
      const sale = await this.getSaleForValidation(client, user, saleId);
      await this.finalizePreparedSale(client, user, sale, dto, {
        effectiveValidationDate: this.todayCivilDate(),
        enforceOfflineReservations: true,
      });
    });
    return this.findOne(user, saleId);
  }

  async replayOfflineValidatedSale(user: AuthUser, operation: SubmitPosSaleValidateOperation): Promise<{
    saleId: string;
    saleNumber: string | null;
    allocations: OfflineReplayAllocationAck[];
  }> {
    let result: { saleId: string; saleNumber: string | null; allocations: OfflineReplayAllocationAck[] } | null = null;

    await this.db.transaction(async (client) => {
      if (operation.tenantId !== user.tenantId) throw new Error('SITE_NOT_ALLOWED');
      if (user.siteId && user.siteId !== operation.siteId) throw new Error('SITE_NOT_ALLOWED');

      const currencyId = await this.defaultCurrencyId();
      await this.assertRelations(
        user,
        operation.siteId,
        currencyId,
        operation.customerId ?? undefined,
        operation.exchangeRateSnapshot ?? undefined,
      );

      const saleNumber = `SAL-${Date.now()}`;
      const fulfillmentStatus = operation.saleMode === 'ADVANCE' ? 'NOT_FULFILLED' : 'FULFILLED';
      const insuranceMembership = operation.saleType === 'INSURANCE'
        ? await this.resolveOfflineInsuranceMembership(client, user.tenantId, operation.membershipId ?? null, operation.customerId ?? null)
        : null;
      const saleCoveragePercent = operation.saleType === 'INSURANCE'
        ? Number(insuranceMembership?.coveragePercent ?? operation.coveragePercentSnapshot ?? 0)
        : 0;
      const created = await client.query<{ sale_id: string }>(
        `INSERT INTO sales (
           tenant_id, sale_number, site_id, customer_id, currency_id, exchange_rate,
           sale_type, sale_mode, fulfillment_status, created_by
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING sale_id`,
        [
          user.tenantId,
          saleNumber,
          operation.siteId,
          operation.customerId ?? null,
          currencyId,
          operation.exchangeRateSnapshot ?? 1,
          operation.saleType,
          operation.saleMode,
          fulfillmentStatus,
          user.userId,
        ],
      );
      const saleId = created.rows[0]?.sale_id;
      if (!saleId) throw new Error('POS_SYNC_CREATE_FAILED');

      const effectiveValidationDate = this.toCivilDateString(operation.validatedAt);
      if (!effectiveValidationDate) throw new Error('LOT_EXPIRY_DATE_INVALID');

      const allocations: OfflineReplayAllocationAck[] = [];

      for (const item of operation.items) {
        await this.assertArticle(user, item.articleId);
        let advanceArticleQuantity = 0;
        for (const allocation of item.lotAllocations) {
          const lockedAllocation = await client.query<OfflineAllocationLockRow>(
            `SELECT allocation_id, workstation_id, site_id, article_id, lot_id,
                    allocated_quantity, consumed_quantity, status, server_version
             FROM offline_stock_allocations
             WHERE tenant_id=$1 AND allocation_id=$2
             FOR UPDATE`,
            [user.tenantId, allocation.allocationId],
          );
          const allocationRow = lockedAllocation.rows[0];
          if (!allocationRow) throw new Error('ALLOCATION_MISMATCH');
          if (
            allocationRow.site_id !== operation.siteId
            || allocationRow.workstation_id !== operation.workstationId
            || allocationRow.article_id !== item.articleId
            || allocationRow.lot_id !== allocation.lotId
          ) {
            throw new Error('ALLOCATION_MISMATCH');
          }

          const remainingQuantity =
            Number(allocationRow.allocated_quantity ?? 0) - Number(allocationRow.consumed_quantity ?? 0);
          if (allocationRow.status !== 'ACTIVE' && remainingQuantity <= 0) {
            throw new Error('ALLOCATION_EXHAUSTED');
          }
          if (allocationRow.status !== 'ACTIVE') {
            throw new Error('ALLOCATION_REVOKED');
          }
          if (remainingQuantity < allocation.quantity) {
            throw new Error('ALLOCATION_EXHAUSTED');
          }

          const lotResult = await client.query<{
            lot_id: string;
            article_id: string;
            lot_number: string;
            expiry_date: string | Date;
            is_blocked: boolean;
          }>(
            `SELECT lot_id, article_id, lot_number, expiry_date, is_blocked
             FROM lots
             WHERE tenant_id=$1 AND lot_id=$2
             FOR UPDATE`,
            [user.tenantId, allocation.lotId],
          );
          const lotRow = lotResult.rows[0];
          if (!lotRow || lotRow.article_id !== item.articleId) throw new Error('ALLOCATION_MISMATCH');
          const lotExpiryDate = this.toCivilDateString(lotRow.expiry_date);
          if (!lotExpiryDate) throw new Error('LOT_EXPIRY_DATE_INVALID');
          if (lotExpiryDate <= effectiveValidationDate) throw new Error('LOT_EXPIRED_AT_OFFLINE_SALE');
          if (lotRow.is_blocked) throw new Error('LOT_BLOCKED_AFTER_OFFLINE_SALE');

          advanceArticleQuantity = this.roundMoney(advanceArticleQuantity + allocation.quantity);
          if (operation.saleMode === 'IMMEDIATE') {
            const lineTotal = this.roundMoney(allocation.quantity * Number(item.unitPriceSnapshot ?? 0));
            const coveredAmount = operation.saleType === 'INSURANCE'
              ? this.roundMoney(lineTotal * saleCoveragePercent / 100)
              : 0;
            const patientAmount = operation.saleType === 'INSURANCE'
              ? this.roundMoney(lineTotal - coveredAmount)
              : lineTotal;
            await client.query(
              `INSERT INTO sale_items (
                 tenant_id, sale_id, article_id, lot_id, quantity, ordered_quantity, fulfilled_quantity,
                 unit_price, coverage_percent, covered_amount, patient_amount, line_total
               )
               VALUES ($1,$2,$3,$4,$5,$5,$5,$6,$7,$8,$9,$10)`,
              [
                user.tenantId,
                saleId,
                item.articleId,
                allocation.lotId,
                allocation.quantity,
                item.unitPriceSnapshot,
                saleCoveragePercent,
                coveredAmount,
                patientAmount,
                lineTotal,
              ],
            );
          }

          const nextConsumedQuantity = this.roundMoney(
            Number(allocationRow.consumed_quantity ?? 0) + allocation.quantity,
          );
          const nextAvailableQuantity = this.roundMoney(
            Math.max(0, Number(allocationRow.allocated_quantity ?? 0) - nextConsumedQuantity),
          );
          const nextStatus = nextAvailableQuantity <= 0 ? 'EXHAUSTED' : 'ACTIVE';
          const nextServerVersion = Number(allocationRow.server_version ?? 0) + 1;

          await client.query(
            `UPDATE offline_stock_allocations
             SET consumed_quantity=$3,
                 status=$4,
                 server_version=$5,
                 updated_at=CURRENT_TIMESTAMP
             WHERE tenant_id=$1 AND allocation_id=$2`,
            [
              user.tenantId,
              allocation.allocationId,
              nextConsumedQuantity,
              nextStatus,
              nextServerVersion,
            ],
          );

          allocations.push({
            allocationId: allocation.allocationId,
            lotId: allocation.lotId,
            acknowledgedQuantity: allocation.quantity,
            serverConsumedQuantity: nextConsumedQuantity,
            availableQuantity: nextAvailableQuantity,
            serverVersion: nextServerVersion,
            status: nextStatus,
          });
        }

        if (operation.saleMode === 'ADVANCE' && advanceArticleQuantity > 0) {
          const lineTotal = this.roundMoney(advanceArticleQuantity * Number(item.unitPriceSnapshot ?? 0));
          const coveredAmount = operation.saleType === 'INSURANCE'
            ? this.roundMoney(lineTotal * saleCoveragePercent / 100)
            : 0;
          const patientAmount = operation.saleType === 'INSURANCE'
            ? this.roundMoney(lineTotal - coveredAmount)
            : lineTotal;
          await client.query(
            `INSERT INTO sale_items (
               tenant_id, sale_id, article_id, lot_id, quantity, ordered_quantity, fulfilled_quantity,
               unit_price, coverage_percent, covered_amount, patient_amount, line_total
             )
             VALUES ($1,$2,$3,NULL,$4,$4,0,$5,$6,$7,$8,$9)`,
            [
              user.tenantId,
              saleId,
              item.articleId,
              advanceArticleQuantity,
              item.unitPriceSnapshot,
              saleCoveragePercent,
              coveredAmount,
              patientAmount,
              lineTotal,
            ],
          );
        }
      }

      await this.recalculateTotal(user, saleId, operation.saleType, client);
      if (insuranceMembership) {
        await client.query(
          `UPDATE sales
           SET organization_id=$3,
               membership_id=$4
           WHERE tenant_id=$1 AND sale_id=$2`,
          [user.tenantId, saleId, insuranceMembership.organizationId, insuranceMembership.membershipId],
        );
      }
      const sale = await this.getSaleForValidation(client, user, saleId, operation.siteId);
      await this.finalizePreparedSale(
        client,
        user,
        sale,
        {
          amountPaid: operation.payment.amountPaidUsd,
          amountPaidUsd: operation.payment.amountPaidUsd,
          amountPaidCdf: operation.payment.amountPaidCdf,
          amountReturnedUsd: operation.payment.amountReturnedUsd,
          amountReturnedCdf: operation.payment.amountReturnedCdf,
          cashSessionId: operation.cashSessionId ?? undefined,
          saleMode: operation.saleMode,
          settlementDifferenceNote: operation.note ?? undefined,
        },
        {
          effectiveValidationDate,
          enforceOfflineReservations: false,
          lotExpiredErrorCode: 'LOT_EXPIRED_AT_OFFLINE_SALE',
          lotBlockedErrorCode: 'LOT_BLOCKED_AFTER_OFFLINE_SALE',
          cashSessionMissingErrorCode: 'CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE',
          validatedAt: operation.validatedAt,
        },
      );

      result = {
        saleId,
        saleNumber,
        allocations,
      };
    });

    if (!result) throw new Error('POS_SYNC_REPLAY_FAILED');
    return result;
  }

  async confirmPickup(user: AuthUser, saleId: string, dto: ConfirmPickupDto) {
    await this.db.transaction(async (client) => {
      const saleResult = await client.query<SaleRow>(
        `SELECT sale_id, tenant_id, sale_number, sale_date, customer_id, NULL::text AS customer_name,
                organization_id, membership_id, site_id, NULL::text AS site_name, currency_id, NULL::text AS currency_code, NULL::text AS currency_symbol, exchange_rate, subtotal,
                insurance_covered_amount, customer_payable_amount, credit_amount, total_amount,
                amount_paid_usd, amount_paid_cdf, amount_returned_usd, amount_returned_cdf,
                net_received_usd, net_received_cdf, settlement_difference_usd,
                settlement_difference_type, settlement_difference_reason, settlement_difference_note,
                sale_type, sale_mode, fulfillment_status, fulfilled_at, pickup_token, pickup_number,
                pickup_site_id, expected_pickup_date, last_fulfillment_at,
                status, created_by, created_at, validated_at
         FROM sales
         WHERE tenant_id=$1 AND sale_id=$2
         FOR UPDATE`,
        [user.tenantId, saleId],
      );
      const sale = saleResult.rows[0];
      if (!sale) throw new Error('SALE_NOT_FOUND');
      if ((sale.sale_mode ?? 'IMMEDIATE') !== 'ADVANCE') throw new Error('SALE_NOT_ADVANCE');
      if (sale.status !== 'VALIDATED') throw new Error('SALE_NOT_VALIDATED');
      if (sale.fulfillment_status === 'FULFILLED') throw new Error('SALE_ALREADY_FULFILLED');
      if (user.siteId && user.siteId !== sale.site_id) throw new Error('SITE_NOT_ALLOWED');

      const saleItems = await client.query<ItemRow>(
        `SELECT si.sale_item_id, si.tenant_id, si.sale_id, si.article_id, NULL::text AS article_code,
                NULL::text AS commercial_name, si.lot_id, NULL::text AS lot_number, NULL::date AS expiry_date,
                si.quantity, si.ordered_quantity, si.fulfilled_quantity, si.unit_price, si.line_total,
                si.sales_unit_snapshot, si.packaging_snapshot
         FROM sale_items si
         WHERE si.tenant_id=$1 AND si.sale_id=$2
         ORDER BY si.sale_item_id`,
        [user.tenantId, saleId],
      );
      if (!saleItems.rows.length) throw new Error('SALE_HAS_NO_ITEMS');

      const targetSiteId = sale.pickup_site_id ?? sale.site_id;
      const fulfillmentNumber = this.buildFulfillmentNumber(sale.sale_number);
      const requestKey = dto.requestKey?.trim() || null;
      if (requestKey) {
        const existingRequest = await client.query<{ fulfillment_id: string }>(
          `SELECT fulfillment_id FROM sale_fulfillments WHERE tenant_id=$1 AND request_key=$2 LIMIT 1`,
          [user.tenantId, requestKey],
        );
        if (existingRequest.rows[0]) return;
      }

      const fulfillment = await client.query<{ fulfillment_id: string; fulfilled_at: Date }>(
        `INSERT INTO sale_fulfillments (
           tenant_id, site_id, sale_id, fulfillment_number, status, fulfilled_by,
           fulfilled_at, note, recipient_name, request_key
         )
         VALUES ($1,$2,$3,$4,'PENDING',$5,CURRENT_TIMESTAMP,$6,$7,$8)
         RETURNING fulfillment_id, fulfilled_at`,
        [user.tenantId, targetSiteId, saleId, fulfillmentNumber, user.userId, dto.note?.trim() || null, dto.recipientName?.trim() || null, requestKey],
      );
      const fulfillmentId = fulfillment.rows[0].fulfillment_id;

      const requestedQuantities = new Map<string, number>();
      if (dto.items?.length) {
        for (const item of dto.items) {
          const quantity = Number(item.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('SALE_PICKUP_QUANTITY_INVALID');
          requestedQuantities.set(item.saleItemId, quantity);
        }
      }

      const allocations: Array<{ saleItemId: string; articleId: string; lotId: string; quantity: number; lotNumber: string | null; expiryDate: string | Date | null; unitPrice: number }> = [];

      for (const item of saleItems.rows) {
        const fulfilled = Number(item.fulfilled_quantity ?? 0);
        const ordered = Number(item.ordered_quantity ?? item.quantity ?? 0);
        const remaining = this.roundMoney(ordered - fulfilled);
        if (remaining <= 0) continue;
        const requested = requestedQuantities.size ? Number(requestedQuantities.get(item.sale_item_id) ?? 0) : remaining;
        if (requested <= 0) continue;
        if (requested > remaining) throw new Error('SALE_PICKUP_QUANTITY_INVALID');
        const lotAllocations = await this.allocateLotsForPickup(client, user.tenantId, targetSiteId, item.article_id, requested);
        if (!lotAllocations.length) throw new Error('SALE_PICKUP_STOCK_INSUFFICIENT');
        let delivered = 0;
        for (const allocation of lotAllocations) {
          delivered += allocation.quantity;
          allocations.push({ saleItemId: item.sale_item_id, articleId: item.article_id, lotId: allocation.lotId, quantity: allocation.quantity, lotNumber: allocation.lotNumber, expiryDate: allocation.expiryDate, unitPrice: Number(item.unit_price ?? 0) });
          await client.query(
            `UPDATE stocks
             SET quantity_available=quantity_available-$4,
                 updated_at=CURRENT_TIMESTAMP
             WHERE tenant_id=$1 AND site_id=$2 AND lot_id=$3`,
            [user.tenantId, targetSiteId, allocation.lotId, allocation.quantity],
          );
          await client.query(
            `INSERT INTO stock_movements (tenant_id, site_id, article_id, lot_id, movement_type, quantity, reference_type, reference_id, notes, user_id)
             VALUES ($1,$2,$3,$4,'SALE_OUT',$5,'SALE_FULFILLMENT',$6,$7,$8)`,
            [
              user.tenantId,
              targetSiteId,
              item.article_id,
              allocation.lotId,
              allocation.quantity,
              fulfillmentId,
              `Livraison vente ${sale.sale_number} (${fulfillmentNumber})`,
              user.userId,
            ],
          );
          await client.query(
            `INSERT INTO sale_fulfillment_items (
               fulfillment_id, sale_item_id, article_id, lot_id, quantity, unit_snapshot
             )
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              fulfillmentId,
              item.sale_item_id,
              item.article_id,
              allocation.lotId,
              allocation.quantity,
              item.sales_unit_snapshot ?? item.packaging_snapshot ?? null,
            ],
          );
        }
        await client.query(
          `UPDATE sale_items
           SET fulfilled_quantity=COALESCE(fulfilled_quantity, 0) + $4
           WHERE tenant_id=$1 AND sale_id=$2 AND sale_item_id=$3`,
          [user.tenantId, saleId, item.sale_item_id, delivered],
        );
      }

      const totals = await client.query<{ total_ordered: string; total_fulfilled: string }>(
        `SELECT
           COALESCE(SUM(ordered_quantity), 0)::numeric AS total_ordered,
           COALESCE(SUM(fulfilled_quantity), 0)::numeric AS total_fulfilled
         FROM sale_items
         WHERE tenant_id=$1 AND sale_id=$2`,
        [user.tenantId, saleId],
      );
      const totalOrdered = Number(totals.rows[0]?.total_ordered ?? 0);
      const totalFulfilled = Number(totals.rows[0]?.total_fulfilled ?? 0);
      const isFullyFulfilled = totalOrdered > 0 && totalFulfilled >= totalOrdered - 0.0001;

      await client.query(
        `UPDATE sales
         SET fulfillment_status=$3,
             fulfilled_at=CASE WHEN $3='FULFILLED' THEN COALESCE(fulfilled_at, CURRENT_TIMESTAMP) ELSE fulfilled_at END,
             last_fulfillment_at=CURRENT_TIMESTAMP,
             pickup_site_id=COALESCE(pickup_site_id, $4),
             expected_pickup_date=COALESCE(expected_pickup_date, CURRENT_DATE)
         WHERE tenant_id=$1 AND sale_id=$2`,
        [user.tenantId, saleId, isFullyFulfilled ? 'FULFILLED' : 'PARTIALLY_FULFILLED', targetSiteId],
      );

      await client.query(
        `UPDATE sale_fulfillments
         SET status=$3,
             updated_at=CURRENT_TIMESTAMP
         WHERE tenant_id=$1 AND sale_id=$2 AND fulfillment_id=$4`,
        [user.tenantId, saleId, isFullyFulfilled ? 'COMPLETED' : 'PARTIALLY_FULFILLED', fulfillmentId],
      );

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
         VALUES ($1,$2,'sales',$3,'CONFIRM_PICKUP',$4::jsonb)`,
        [user.tenantId, user.userId, saleId, JSON.stringify({ saleNumber: sale.sale_number, fulfillmentNumber, requestKey, allocations, fullyFulfilled: isFullyFulfilled })],
      );
    });
    return this.findOne(user, saleId);
  }

  private async defaultPaymentMethodInfo(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ payment_method_id: string; method_code: string }> }> }) {
    const result = await client.query(`SELECT payment_method_id, method_code FROM payment_methods WHERE method_code='CASH' LIMIT 1`);
    if (!result.rows[0]) throw new Error('PAYMENT_METHOD_NOT_FOUND');
    return result.rows[0];
  }

  private async paymentMethodInfo(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ payment_method_id: string; method_code: string }> }> }, paymentMethodId: string) {
    const result = await client.query(
      `SELECT payment_method_id, method_code
       FROM payment_methods
       WHERE payment_method_id=$1
       LIMIT 1`,
      [paymentMethodId],
    );
    if (!result.rows[0]) throw new Error('PAYMENT_METHOD_NOT_FOUND');
    return result.rows[0];
  }

  private async resolveOfflineInsuranceMembership(
    client: Queryable,
    tenantId: string,
    membershipId: string | null,
    customerId: string | null,
  ) {
    if (!membershipId || !customerId) throw new Error('MEMBERSHIP_NOT_ACTIVE');
    const result = await client.query<{
      membership_id: string;
      organization_id: string;
      plan_id: string | null;
      coverage_percent: string | null;
    }>(
      `SELECT cm.membership_id, cm.organization_id, cm.plan_id, ip.coverage_percent
       FROM customer_memberships cm
       JOIN organizations o ON o.organization_id=cm.organization_id AND o.tenant_id=cm.tenant_id
       LEFT JOIN insurance_plans ip ON ip.plan_id=cm.plan_id AND ip.organization_id=cm.organization_id
       WHERE cm.tenant_id=$1
         AND cm.membership_id=$2
         AND cm.customer_id=$3
         AND cm.is_active=true
         AND o.is_active=true
         AND (cm.valid_from IS NULL OR cm.valid_from <= CURRENT_DATE)
         AND (cm.valid_to IS NULL OR cm.valid_to >= CURRENT_DATE)
       LIMIT 1`,
      [tenantId, membershipId, customerId],
    );
    const membership = result.rows[0];
    if (!membership) throw new Error('MEMBERSHIP_NOT_ACTIVE');
    return {
      membershipId: membership.membership_id,
      organizationId: membership.organization_id,
      planId: membership.plan_id,
      coveragePercent: Number(membership.coverage_percent ?? 0),
    };
  }

  private async currencyIdsByCode(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ currency_id: string; currency_code: string }> }> }) {
    const result = await client.query(
      `SELECT currency_id, currency_code
       FROM currencies
       WHERE currency_code IN ('USD','CDF')`,
    );
    const byCode = new Map(result.rows.map((row) => [row.currency_code, row.currency_id]));
    if (!byCode.get('USD') || !byCode.get('CDF')) throw new Error('CURRENCY_NOT_FOUND');
    return { USD: byCode.get('USD')!, CDF: byCode.get('CDF')! };
  }

  private buildPickupToken(saleNumber: string) {
    return `PICK-${saleNumber}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private buildPickupNumber(saleNumber: string) {
    return `RET-${saleNumber}`;
  }

  private buildFulfillmentNumber(saleNumber: string) {
    return `LIV-${saleNumber}-${Date.now().toString().slice(-6)}`;
  }

  private async allocateLotsForPickup(
    client: Queryable,
    tenantId: string,
    siteId: string,
    articleId: string,
    quantity: number,
  ) {
    const available = await client.query<{ lot_id: string; lot_number: string; expiry_date: string | Date; quantity_available: string }>(
      `SELECT l.lot_id, l.lot_number, l.expiry_date, st.quantity_available
       FROM stocks st
       JOIN lots l ON l.lot_id=st.lot_id AND l.tenant_id=st.tenant_id
       WHERE st.tenant_id=$1
         AND st.site_id=$2
         AND l.article_id=$3
         AND st.quantity_available > 0
         AND l.expiry_date > CURRENT_DATE
         AND l.is_blocked = false
       ORDER BY l.expiry_date ASC, l.lot_number ASC
       FOR UPDATE`,
      [tenantId, siteId, articleId],
    );

    let remaining = quantity;
    const allocations: Array<{ lotId: string; lotNumber: string; expiryDate: string | Date; quantity: number }> = [];
    for (const lot of available.rows) {
      if (remaining <= 0) break;
      const reservedQuantity = await this.getOfflineReservedQuantity(client, tenantId, siteId, lot.lot_id);
      const availableQuantity = Math.max(0, Number(lot.quantity_available ?? 0) - reservedQuantity);
      if (availableQuantity <= 0) continue;
      const take = Math.min(remaining, availableQuantity);
      allocations.push({ lotId: lot.lot_id, lotNumber: lot.lot_number, expiryDate: lot.expiry_date, quantity: take });
      remaining -= take;
    }
    if (remaining > 0) return [];
    return allocations;
  }

  private buildSettlementSnapshot(sale: SaleRow, dto: ValidateSaleDto, patientPayable: number): SettlementSnapshot {
    const exchangeRate = Number(sale.exchange_rate || 1);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('EXCHANGE_RATE_REQUIRED');

    const usesDetailedPayload =
      dto.amountPaidUsd !== undefined
      || dto.amountPaidCdf !== undefined
      || dto.amountReturnedUsd !== undefined
      || dto.amountReturnedCdf !== undefined;

    const amountPaidUsd = this.roundMoney(usesDetailedPayload ? Number(dto.amountPaidUsd ?? 0) : Number(dto.amountPaid ?? 0));
    const amountPaidCdf = this.roundMoney(Number(dto.amountPaidCdf ?? 0));
    const amountReturnedUsd = this.roundMoney(Number(dto.amountReturnedUsd ?? 0));
    const amountReturnedCdf = this.roundMoney(Number(dto.amountReturnedCdf ?? 0));

    if ([amountPaidUsd, amountPaidCdf, amountReturnedUsd, amountReturnedCdf].some((amount) => amount < 0)) {
      throw new Error('INVALID_SETTLEMENT_AMOUNT');
    }
    if (amountReturnedUsd > amountPaidUsd || amountReturnedCdf > amountPaidCdf) {
      throw new Error('INVALID_SETTLEMENT_RETURN');
    }
    if ((amountReturnedUsd > 0 && amountPaidUsd === 0) || (amountReturnedCdf > 0 && amountPaidCdf === 0)) {
      throw new Error('INVALID_SETTLEMENT_RETURN');
    }

    const netReceivedUsd = this.roundMoney(amountPaidUsd - amountReturnedUsd);
    const netReceivedCdf = this.roundMoney(amountPaidCdf - amountReturnedCdf);
    const cdfEquivalentUsd = this.roundMoney(netReceivedCdf / exchangeRate);
    const netTotalEquivalentUsd = this.roundMoney(netReceivedUsd + cdfEquivalentUsd);
    const settlementDifferenceUsd = this.roundMoney(netTotalEquivalentUsd - patientPayable);
    const settlementDifferenceReason = dto.settlementDifferenceReason?.trim() || null;
    const settlementDifferenceNote = dto.settlementDifferenceNote?.trim() || null;

    return {
      amountPaidUsd,
      amountPaidCdf,
      amountReturnedUsd,
      amountReturnedCdf,
      netReceivedUsd,
      netReceivedCdf,
      netTotalEquivalentUsd,
      settlementDifferenceUsd,
      settlementDifferenceType: this.classifySettlementDifference(settlementDifferenceUsd, amountPaidCdf, amountPaidUsd),
      settlementDifferenceReason,
      settlementDifferenceNote,
    };
  }

  private classifySettlementDifference(differenceUsd: number, amountPaidCdf: number, amountPaidUsd: number) {
    if (differenceUsd === 0) return 'NONE';
    if (Math.abs(differenceUsd) <= SETTLEMENT_TOLERANCE_USD) {
      return amountPaidCdf > 0 && amountPaidUsd === 0 ? 'EXCHANGE_ROUNDING' : 'ROUNDING';
    }
    return differenceUsd > 0 ? 'OVERPAYMENT' : 'UNDERPAYMENT';
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async getSaleForValidation(client: Queryable, user: AuthUser, saleId: string, siteIdOverride?: string | null) {
    const saleResult = await client.query<SaleRow>(
      `SELECT sale_id, tenant_id, sale_number, sale_date, customer_id, NULL::text AS customer_name,
              organization_id, membership_id, site_id, NULL::text AS site_name, currency_id, NULL::text AS currency_code, NULL::text AS currency_symbol, exchange_rate, subtotal,
              insurance_covered_amount, customer_payable_amount, credit_amount, total_amount,
              amount_paid_usd, amount_paid_cdf, amount_returned_usd, amount_returned_cdf,
              net_received_usd, net_received_cdf, settlement_difference_usd,
              settlement_difference_type, settlement_difference_reason, settlement_difference_note,
              sale_type, sale_mode, fulfillment_status, fulfilled_at, pickup_token, pickup_number,
              pickup_site_id, expected_pickup_date, last_fulfillment_at,
              status, created_by, created_at, validated_at
       FROM sales
       WHERE tenant_id=$1 AND sale_id=$2
         AND ($3::uuid IS NULL OR site_id=$3::uuid)
       FOR UPDATE`,
      [user.tenantId, saleId, siteIdOverride ?? user.siteId ?? null],
    );
    const sale = saleResult.rows[0];
    if (!sale) throw new Error('SALE_NOT_FOUND');
    if (sale.status !== 'DRAFT') throw new Error('SALE_NOT_DRAFT');
    return sale;
  }

  private async finalizePreparedSale(
    client: Queryable,
    user: AuthUser,
    sale: SaleRow,
    dto: ValidateSaleDto,
    options: FinalizeSaleOptions = {},
  ) {
    const total = Number(sale.total_amount);
    const patientPayable = sale.sale_type === 'INSURANCE' ? Number(sale.customer_payable_amount ?? 0) : total;
    const insuranceCovered = Number(sale.insurance_covered_amount ?? 0);
    const resolvedSaleMode = dto.saleMode ?? sale.sale_mode ?? 'IMMEDIATE';
    const isAdvanceSale = resolvedSaleMode === 'ADVANCE';
    if (total <= 0) throw new Error('SALE_HAS_NO_ITEMS');
    if (
      sale.sale_type === 'INSURANCE'
      && (!sale.customer_id || !sale.organization_id || !sale.membership_id || insuranceCovered <= 0)
    ) {
      throw new Error('MEMBERSHIP_NOT_ACTIVE');
    }

    const settlement = this.buildSettlementSnapshot(sale, dto, patientPayable);
    if (settlement.settlementDifferenceUsd < -SETTLEMENT_TOLERANCE_USD) throw new Error('PAYMENT_INSUFFICIENT');
    if (settlement.settlementDifferenceUsd > SETTLEMENT_TOLERANCE_USD && !settlement.settlementDifferenceReason) {
      throw new Error('SETTLEMENT_REASON_REQUIRED');
    }

    const items = await client.query<ItemRow>(
      `SELECT si.sale_item_id, si.tenant_id, si.sale_id, si.article_id, NULL::text AS article_code,
              NULL::text AS commercial_name, si.lot_id, NULL::text AS lot_number, NULL::date AS expiry_date,
              si.quantity, si.ordered_quantity, si.fulfilled_quantity, si.unit_price, si.line_total,
              si.sales_unit_snapshot, si.packaging_snapshot
       FROM sale_items si
       WHERE si.tenant_id=$1 AND si.sale_id=$2`,
      [user.tenantId, sale.sale_id],
    );
    if (!items.rows.length) throw new Error('SALE_HAS_NO_ITEMS');

    const effectiveValidationDate = options.effectiveValidationDate ?? this.todayCivilDate();
    const enforceOfflineReservations = options.enforceOfflineReservations ?? true;

    if (!isAdvanceSale) {
      for (const item of items.rows) {
        const stock = await client.query<{
          stock_id: string;
          quantity_available: string;
          expiry_date: string | Date;
          is_blocked: boolean;
        }>(
          `SELECT st.stock_id, st.quantity_available, l.expiry_date, l.is_blocked
           FROM stocks st
           JOIN lots l ON l.lot_id=st.lot_id AND l.tenant_id=st.tenant_id
           WHERE st.tenant_id=$1 AND st.site_id=$2 AND st.lot_id=$3
           FOR UPDATE`,
          [user.tenantId, sale.site_id, item.lot_id],
        );
        const row = stock.rows[0];
        const reservedQuantity = enforceOfflineReservations && item.lot_id
          ? await this.getOfflineReservedQuantity(client, user.tenantId, sale.site_id, item.lot_id)
          : 0;
        const availableQuantity = row
          ? Math.max(0, Number(row.quantity_available ?? 0) - reservedQuantity)
          : 0;

        if (!row || availableQuantity < Number(item.quantity)) throw new Error('STOCK_INSUFFICIENT');
        const expiryDate = this.toCivilDateString(row.expiry_date);
        if (!expiryDate) throw new Error('LOT_EXPIRY_DATE_INVALID');
        if (expiryDate <= effectiveValidationDate) {
          throw new Error(options.lotExpiredErrorCode ?? 'LOT_EXPIRED');
        }
        if (row.is_blocked) {
          throw new Error(options.lotBlockedErrorCode ?? 'LOT_BLOCKED');
        }

        await client.query(
          `UPDATE stocks
           SET quantity_available=quantity_available-$4,
               updated_at=CURRENT_TIMESTAMP
           WHERE tenant_id=$1 AND site_id=$2 AND lot_id=$3`,
          [user.tenantId, sale.site_id, item.lot_id, item.quantity],
        );
        await client.query(
          `INSERT INTO stock_movements (
             tenant_id, site_id, article_id, lot_id, movement_type, quantity,
             reference_type, reference_id, notes, user_id
           )
           VALUES ($1,$2,$3,$4,'SALE_OUT',$5,'SALE',$6,$7,$8)`,
          [
            user.tenantId,
            sale.site_id,
            item.article_id,
            item.lot_id,
            item.quantity,
            sale.sale_id,
            `Validation vente ${sale.sale_number}`,
            user.userId,
          ],
        );
      }
    }

    const method = dto.paymentMethodId
      ? await this.paymentMethodInfo(client, dto.paymentMethodId)
      : await this.defaultPaymentMethodInfo(client);
    if ((settlement.amountReturnedUsd > 0 || settlement.amountReturnedCdf > 0) && method.method_code !== 'CASH') {
      throw new Error('CHANGE_NOT_ALLOWED_FOR_NON_CASH');
    }
    if (patientPayable > 0) {
      await client.query(
        `INSERT INTO payments (tenant_id, sale_id, payment_method_id, currency_id, amount, reference_payment, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [user.tenantId, sale.sale_id, method.payment_method_id, sale.currency_id, patientPayable, dto.referencePayment ?? null, user.userId],
      );
    }

    let activeCashSession:
      | { cash_session_id: string; workstation_id: string | null; workstation_name: string | null; device_uuid: string | null }
      | null = null;
    if ((sale.sale_type === 'CASH' || sale.sale_type === 'INSURANCE') && (settlement.amountPaidUsd > 0 || settlement.amountPaidCdf > 0)) {
      const session = await client.query<{ cash_session_id: string; workstation_id: string | null; workstation_name: string | null; device_uuid: string | null }>(
        `SELECT cash_session_id, workstation_id, workstation_name, device_uuid
         FROM cash_sessions
         WHERE tenant_id=$1 AND site_id=$2 AND user_id=$3 AND status='OPEN'
           AND ($4::uuid IS NULL OR cash_session_id=$4::uuid)
         ORDER BY opened_at DESC
         LIMIT 1`,
        [user.tenantId, sale.site_id, user.userId, dto.cashSessionId ?? null],
      );
      if (dto.cashSessionId && !session.rows[0]) {
        throw new Error(options.cashSessionMissingErrorCode ?? 'CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE');
      }
      if (session.rows[0]) {
        activeCashSession = session.rows[0];
        const currencies = await this.currencyIdsByCode(client);
        const movementRows = [
          settlement.amountPaidUsd > 0 ? { movementType: 'SALE_PAYMENT', amount: settlement.amountPaidUsd, currencyId: currencies.USD, description: `Paiement brut USD vente ${sale.sale_number}` } : null,
          settlement.amountPaidCdf > 0 ? { movementType: 'SALE_PAYMENT', amount: settlement.amountPaidCdf, currencyId: currencies.CDF, description: `Paiement brut CDF vente ${sale.sale_number}` } : null,
          settlement.amountReturnedUsd > 0 ? { movementType: 'SALE_CHANGE', amount: settlement.amountReturnedUsd, currencyId: currencies.USD, description: `Monnaie rendue USD vente ${sale.sale_number}` } : null,
          settlement.amountReturnedCdf > 0 ? { movementType: 'SALE_CHANGE', amount: settlement.amountReturnedCdf, currencyId: currencies.CDF, description: `Monnaie rendue CDF vente ${sale.sale_number}` } : null,
        ].filter(Boolean) as Array<{ movementType: string; amount: number; currencyId: string; description: string }>;

        for (const movement of movementRows) {
          await client.query(
            `INSERT INTO cash_movements (
               tenant_id, cash_session_id, movement_type, amount, currency_id,
               reference_type, reference_id, description, created_by
             )
             VALUES ($1,$2,$3,$4,$5,'SALE',$6,$7,$8)`,
            [
              user.tenantId,
              activeCashSession.cash_session_id,
              movement.movementType,
              movement.amount,
              movement.currencyId,
              sale.sale_id,
              movement.description,
              user.userId,
            ],
          );
        }
      }
    }

    if (sale.sale_type === 'INSURANCE' && insuranceCovered > 0) {
      await client.query(
        `INSERT INTO accounts_receivable (
           tenant_id, sale_id, customer_id, organization_id, currency_id, receivable_type,
           invoice_number, due_date, amount_due, amount_paid, balance, status, notes, created_by
         )
         VALUES ($1,$2,$3,$4,$5,'INSURANCE_CLAIM',$6,CURRENT_DATE + INTERVAL '30 days',$7,0,$7,'OPEN',$8,$9)`,
        [user.tenantId, sale.sale_id, sale.customer_id, sale.organization_id, sale.currency_id, `AR-${sale.sale_number}`, insuranceCovered, `Creance assurance vente ${sale.sale_number}`, user.userId],
      );
    }

    const accountingLines = [
      ...(patientPayable > 0 ? [{ accountCode: '57', debit: patientPayable, description: `Encaissement vente ${sale.sale_number}` }] : []),
      ...(sale.sale_type === 'INSURANCE' && insuranceCovered > 0 ? [{ accountCode: '41', debit: insuranceCovered, description: `Creance assurance vente ${sale.sale_number}` }] : []),
      { accountCode: '70', credit: total, description: `Vente marchandises ${sale.sale_number}` },
    ];
    await this.accounting.createAutomaticEntry(client as any, user, {
      journalCode: 'VEN',
      referenceType: 'SALE',
      referenceId: sale.sale_id,
      description: `Validation vente ${sale.sale_number}`,
      lines: accountingLines,
    });

    const validationTimestamp = options.validatedAt ? new Date(options.validatedAt) : new Date();
    const fulfilledTimestamp = isAdvanceSale ? null : validationTimestamp;
    await client.query(
      `UPDATE sales
       SET status='VALIDATED',
           validated_at=$25,
           sale_mode=$17,
           fulfillment_status=$18,
           fulfilled_at=$19,
           pickup_token=$20,
           pickup_number=$21,
           pickup_site_id=$22,
           expected_pickup_date=$23,
           last_fulfillment_at=$24,
           amount_paid_usd=$3,
           amount_paid_cdf=$4,
           amount_returned_usd=$5,
           amount_returned_cdf=$6,
           net_received_usd=$7,
           net_received_cdf=$8,
           settlement_difference_usd=$9,
           settlement_difference_type=$10,
           settlement_difference_reason=$11,
           settlement_difference_note=$12,
           cash_session_id=$13,
           workstation_id=$14,
           workstation_name=$15,
           device_uuid=$16
       WHERE tenant_id=$1 AND sale_id=$2`,
      [
        user.tenantId,
        sale.sale_id,
        settlement.amountPaidUsd,
        settlement.amountPaidCdf,
        settlement.amountReturnedUsd,
        settlement.amountReturnedCdf,
        settlement.netReceivedUsd,
        settlement.netReceivedCdf,
        settlement.settlementDifferenceUsd,
        settlement.settlementDifferenceType,
        settlement.settlementDifferenceReason,
        settlement.settlementDifferenceNote,
        activeCashSession?.cash_session_id ?? null,
        activeCashSession?.workstation_id ?? null,
        activeCashSession?.workstation_name ?? null,
        activeCashSession?.device_uuid ?? null,
        resolvedSaleMode,
        isAdvanceSale ? 'NOT_FULFILLED' : 'FULFILLED',
        fulfilledTimestamp,
        isAdvanceSale ? this.buildPickupToken(sale.sale_number) : null,
        isAdvanceSale ? this.buildPickupNumber(sale.sale_number) : null,
        isAdvanceSale ? sale.site_id : null,
        isAdvanceSale ? validationTimestamp.toISOString().slice(0, 10) : null,
        isAdvanceSale ? null : validationTimestamp,
        validationTimestamp,
      ],
    );
    await client.query(
      `INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
       VALUES ($1,$2,'sales',$3,'VALIDATE',$4::jsonb)`,
      [
        user.tenantId,
        user.userId,
        sale.sale_id,
        JSON.stringify({
          status: 'VALIDATED',
          saleNumber: sale.sale_number,
          settlement,
          offlineReplay: options.enforceOfflineReservations === false,
        }),
      ],
    );
  }

  private async getOfflineReservedQuantity(
    client: Queryable,
    tenantId: string,
    siteId: string,
    lotId: string,
  ) {
    const reserved = await client.query<{ reserved_quantity: string }>(
      `SELECT COALESCE(SUM(GREATEST(allocated_quantity - consumed_quantity, 0)), 0)::numeric AS reserved_quantity
       FROM offline_stock_allocations
       WHERE tenant_id=$1
         AND site_id=$2
         AND lot_id=$3
         AND status='ACTIVE'`,
      [tenantId, siteId, lotId],
    );
    return Number(reserved.rows[0]?.reserved_quantity ?? 0);
  }

  private async findItems(user: AuthUser, saleId: string) {
    const r = await this.db.query<ItemRow>(
      `SELECT si.sale_item_id, si.tenant_id, si.sale_id, si.article_id, a.article_code, a.commercial_name,
              si.lot_id, l.lot_number, l.expiry_date, si.quantity, si.ordered_quantity, si.fulfilled_quantity,
              si.unit_price, si.line_total, si.sales_unit_snapshot, si.packaging_snapshot
       FROM sale_items si
       JOIN articles a ON a.article_id=si.article_id AND a.tenant_id=si.tenant_id
       LEFT JOIN lots l ON l.lot_id=si.lot_id AND l.tenant_id=si.tenant_id
       WHERE si.tenant_id=$1 AND si.sale_id=$2 ORDER BY si.sale_item_id`,
      [user.tenantId, saleId],
    );
    return r.rows.map(this.toItem);
  }

  private async findPayments(user: AuthUser, saleId: string) {
    const r = await this.db.query(
      `SELECT p.payment_id, p.sale_id, p.payment_date, p.payment_method_id, pm.method_name, p.currency_id, cur.currency_code,
              CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS currency_symbol,
              p.amount, p.reference_payment, p.received_by, u.full_name AS received_by_name
       FROM payments p JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id
       LEFT JOIN currencies cur ON cur.currency_id=p.currency_id
       LEFT JOIN users u ON u.user_id=p.received_by AND u.tenant_id=p.tenant_id
       WHERE p.tenant_id=$1 AND p.sale_id=$2 ORDER BY p.payment_date`,
      [user.tenantId, saleId],
    );
    return r.rows.map((row) => ({ paymentId: row.payment_id, saleId: row.sale_id, paymentDate: row.payment_date, paymentMethodId: row.payment_method_id, methodName: row.method_name, currencyId: row.currency_id, currencyCode: row.currency_code, currencySymbol: row.currency_symbol, amount: Number(row.amount), referencePayment: row.reference_payment, receivedBy: row.received_by, receivedByName: row.received_by_name }));
  }

  private async recalculateTotal(
    user: AuthUser,
    saleId: string,
    saleType?: string,
    queryable?: Queryable,
  ) {
    const db = queryable ?? (this.db as unknown as Queryable);
    await db.query(
      `UPDATE sales SET subtotal=COALESCE((SELECT SUM(line_total) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0),
                        total_amount=COALESCE((SELECT SUM(line_total) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0),
                        insurance_covered_amount=CASE WHEN COALESCE($3, sale_type)='INSURANCE' THEN COALESCE((SELECT SUM(covered_amount) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0) ELSE 0 END,
                        customer_payable_amount=CASE WHEN COALESCE($3, sale_type)='INSURANCE' THEN COALESCE((SELECT SUM(patient_amount) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0) ELSE COALESCE((SELECT SUM(line_total) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0) END,
                        credit_amount=CASE WHEN COALESCE($3, sale_type)='INSURANCE' THEN COALESCE((SELECT SUM(covered_amount) FROM sale_items WHERE tenant_id=$1 AND sale_id=$2),0) ELSE 0 END
       WHERE tenant_id=$1 AND sale_id=$2`,
      [user.tenantId, saleId, saleType ?? null],
    );
  }

  private async assertRelations(user: AuthUser, siteId: string, currencyId: string, customerId?: string, exchangeRate?: number) {
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
    const currency = await this.db.query<{ currency_code: string }>(`SELECT currency_code FROM currencies WHERE currency_id=$1`, [currencyId]);
    if (currency.rows[0]?.currency_code === 'CDF' && (!exchangeRate || exchangeRate <= 1)) throw new Error('EXCHANGE_RATE_REQUIRED');
    if (Number(r.rows[0]?.customers_count ?? 0) !== 1) throw new Error('CUSTOMER_NOT_IN_TENANT');
  }

  private async defaultCurrencyId() {
    const result = await this.db.query<{ currency_id: string }>(
      `SELECT currency_id FROM currencies WHERE currency_code='USD' OR is_default=true ORDER BY is_default DESC LIMIT 1`,
    );
    if (!result.rows[0]) throw new Error('CURRENCY_NOT_FOUND');
    return result.rows[0].currency_id;
  }

  private async assertArticle(user: AuthUser, articleId: string) {
    const r = await this.db.query<{ total: string }>(`SELECT COUNT(*)::int AS total FROM articles WHERE tenant_id=$1 AND article_id=$2 AND is_active=true`, [user.tenantId, articleId]);
    if (Number(r.rows[0]?.total ?? 0) !== 1) throw new Error('ARTICLE_NOT_IN_TENANT');
  }

  private async assertCustomer(user: AuthUser, customerId: string) {
    const r = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM customers WHERE tenant_id=$1 AND customer_id=$2 AND is_active=true`,
      [user.tenantId, customerId],
    );
    if (Number(r.rows[0]?.total ?? 0) !== 1) throw new Error('CUSTOMER_NOT_IN_TENANT');
  }

  private buildListFilterSql(user: AuthUser, query: ListSalesDto) {
    const filters = ['s.tenant_id = $1', '($2::uuid IS NULL OR s.site_id = $2::uuid)'];
    const params: unknown[] = [user.tenantId, user.siteId ?? null];

    if (query.siteId) {
      params.push(query.siteId);
      filters.push(`s.site_id = $${params.length}::uuid`);
    }

    if (query.status) {
      params.push(query.status);
      filters.push(`s.status = $${params.length}`);
    }

    if (query.saleType) {
      params.push(query.saleType);
      filters.push(`s.sale_type = $${params.length}`);
    }

    if (query.saleMode) {
      if (query.saleMode === 'REALIZED') {
        filters.push(`s.sale_mode = 'ADVANCE' AND s.fulfillment_status = 'FULFILLED'`);
      } else if (query.saleMode === 'PENDING_PICKUP') {
        filters.push(`s.sale_mode = 'ADVANCE' AND s.fulfillment_status <> 'FULFILLED'`);
      } else {
        params.push(query.saleMode);
        filters.push(`s.sale_mode = $${params.length}`);
      }
    }

    if (query.fulfillmentStatus) {
      params.push(query.fulfillmentStatus);
      filters.push(`s.fulfillment_status = $${params.length}`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      filters.push(`s.sale_date >= $${params.length}::date`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      filters.push(`s.sale_date < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (query.saleNumber?.trim()) {
      params.push(`%${query.saleNumber.trim()}%`);
      filters.push(`s.sale_number ILIKE $${params.length}`);
    }

    if (query.customer?.trim()) {
      params.push(`%${query.customer.trim()}%`);
      filters.push(`(
        c.customer_name ILIKE $${params.length}
        OR o.organization_name ILIKE $${params.length}
      )`);
    }

    if (query.seller?.trim()) {
      params.push(`%${query.seller.trim()}%`);
      filters.push(`u.full_name ILIKE $${params.length}`);
    }

    if (query.paymentMode?.trim()) {
      params.push(query.paymentMode.trim());
      params.push(`%${query.paymentMode.trim()}%`);
      const codeParam = params.length - 1;
      const nameParam = params.length;
      filters.push(`EXISTS (
        SELECT 1
        FROM payments p
        JOIN payment_methods pm ON pm.payment_method_id = p.payment_method_id
        WHERE p.tenant_id = s.tenant_id
          AND p.sale_id = s.sale_id
          AND (
            pm.method_code = $${codeParam}
            OR pm.method_name ILIKE $${nameParam}
          )
      )`);
    }

    return { where: filters.join(' AND '), params };
  }

  private resolveListSort(sortBy?: string) {
    if (sortBy === 'totalAmount') return 'filtered_sales.total_amount';
    if (sortBy === 'createdAt') return 'filtered_sales.created_at';
    return 'filtered_sales.sale_date';
  }

  private toSale(row: SaleRow) { return { saleId: row.sale_id, tenantId: row.tenant_id, saleNumber: row.sale_number, saleDate: row.sale_date, customerId: row.customer_id, customerName: row.customer_name, organizationId: row.organization_id ?? null, organizationName: row.organization_name ?? null, membershipId: row.membership_id ?? null, planName: row.plan_name ?? null, coveragePercent: row.coverage_percent === null || row.coverage_percent === undefined ? null : Number(row.coverage_percent), siteId: row.site_id, siteName: row.site_name, currencyId: row.currency_id, currencyCode: row.currency_code, currencySymbol: row.currency_symbol, exchangeRate: Number(row.exchange_rate), subtotal: Number(row.subtotal), discountAmount: Number(row.discount_amount ?? 0), insuranceCoveredAmount: Number(row.insurance_covered_amount ?? 0), customerPayableAmount: Number(row.customer_payable_amount ?? row.total_amount), creditAmount: Number(row.credit_amount ?? 0), totalAmount: Number(row.total_amount), amountPaidUsd: Number(row.amount_paid_usd ?? 0), amountPaidCdf: Number(row.amount_paid_cdf ?? 0), amountReturnedUsd: Number(row.amount_returned_usd ?? 0), amountReturnedCdf: Number(row.amount_returned_cdf ?? 0), netReceivedUsd: Number(row.net_received_usd ?? 0), netReceivedCdf: Number(row.net_received_cdf ?? 0), settlementDifferenceUsd: Number(row.settlement_difference_usd ?? 0), settlementDifferenceType: row.settlement_difference_type ?? 'NONE', settlementDifferenceReason: row.settlement_difference_reason ?? null, settlementDifferenceNote: row.settlement_difference_note ?? null, saleType: row.sale_type, saleMode: row.sale_mode ?? 'IMMEDIATE', fulfillmentStatus: row.fulfillment_status ?? 'FULFILLED', fulfilledAt: row.fulfilled_at ?? null, pickupToken: row.pickup_token ?? null, pickupNumber: row.pickup_number ?? null, pickupSiteId: row.pickup_site_id ?? null, expectedPickupDate: row.expected_pickup_date ?? null, lastFulfillmentAt: row.last_fulfillment_at ?? null, status: row.status, createdBy: row.created_by, createdAt: row.created_at, validatedAt: row.validated_at }; }
  private toItem(row: ItemRow) { return { saleItemId: row.sale_item_id, saleId: row.sale_id, articleId: row.article_id, articleCode: row.article_code, commercialName: row.commercial_name, lotId: row.lot_id ?? null, lotNumber: row.lot_number ?? null, expiryDate: row.expiry_date, quantity: Number(row.quantity), orderedQuantity: Number(row.ordered_quantity ?? row.quantity), fulfilledQuantity: Number(row.fulfilled_quantity ?? 0), unitPrice: Number(row.unit_price), lineTotal: Number(row.line_total), salesUnitSnapshot: row.sales_unit_snapshot ?? null, packagingSnapshot: row.packaging_snapshot ?? null }; }

  private toCivilDateString(value: string | Date) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  private todayCivilDate() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  }
}
