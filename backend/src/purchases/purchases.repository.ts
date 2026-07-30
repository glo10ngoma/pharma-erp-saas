import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { AddPurchaseItemDto } from './dto/add-purchase-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

type PurchaseRow = {
  purchase_id: string;
  tenant_id: string;
  purchase_number: string;
  purchase_date: string;
  supplier_id: string;
  supplier_name: string | null;
  site_id: string;
  site_name: string | null;
  currency_id: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  exchange_rate: string;
  total_amount: string;
  payment_status: string | null;
  payment_source: string | null;
  payment_method: string | null;
  total_equivalent_usd: string | null;
  amount_paid_usd: string | null;
  amount_paid_cdf: string | null;
  paid_equivalent_usd: string | null;
  outstanding_balance_usd: string | null;
  cash_session_id: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  status: string;
  created_by: string | null;
  created_at: Date;
  validated_at: Date | null;
};

type ItemRow = {
  purchase_item_id: string;
  tenant_id: string;
  purchase_id: string;
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  lot_number: string;
  expiry_date: string;
  quantity: string;
  purchase_unit_id: string | null;
  purchase_unit_label_snapshot: string | null;
  purchase_quantity: string | null;
  conversion_factor: string | null;
  stock_unit_id: string | null;
  stock_unit_label_snapshot: string | null;
  stock_quantity: string | null;
  line_order: number | null;
  unit_price_currency: string | null;
  line_total_currency: string | null;
  purchase_unit_price: string;
  selling_unit_price: string;
  line_total: string;
};

type PaymentHistoryRow = {
  purchase_payment_id: string;
  purchase_id: string;
  cash_session_id: string | null;
  currency_code: string | null;
  amount: string;
  exchange_rate_applied: string;
  amount_equivalent_usd: string;
  payment_source: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  status: string | null;
  created_at: Date;
  created_by: string | null;
  created_by_name: string | null;
  cash_movement_id: string | null;
};

@Injectable()
export class PurchasesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser, status?: string) {
    const params: unknown[] = [user.tenantId];
    const filters = ['p.tenant_id = $1'];
    if (user.siteId) {
      params.push(user.siteId);
      filters.push(`p.site_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      filters.push(`p.status = $${params.length}`);
    }
    const result = await this.db.query<PurchaseRow>(
      `
      SELECT p.purchase_id, p.tenant_id, p.purchase_number, p.purchase_date, p.supplier_id,
             sup.supplier_name, p.site_id, s.site_name, p.currency_id, cur.currency_code,
             CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS currency_symbol,
             p.exchange_rate, p.total_amount, p.payment_status, p.payment_source, p.payment_method,
             p.total_equivalent_usd, p.amount_paid_usd, p.amount_paid_cdf, p.paid_equivalent_usd,
             p.outstanding_balance_usd, p.cash_session_id, p.payment_reference, p.payment_note,
             p.status, p.created_by, p.created_at, p.validated_at
      FROM purchases p
      JOIN suppliers sup ON sup.supplier_id = p.supplier_id AND sup.tenant_id = p.tenant_id
      JOIN sites s ON s.site_id = p.site_id AND s.tenant_id = p.tenant_id
      LEFT JOIN currencies cur ON cur.currency_id = p.currency_id
      WHERE ${filters.join(' AND ')}
      ORDER BY p.created_at DESC
      `,
      params,
    );
    return result.rows.map(this.toPurchase);
  }

  async findOne(user: AuthUser, id: string) {
    const purchase = await this.db.query<PurchaseRow>(
      `
      SELECT p.purchase_id, p.tenant_id, p.purchase_number, p.purchase_date, p.supplier_id,
             sup.supplier_name, p.site_id, s.site_name, p.currency_id, cur.currency_code,
             CASE WHEN cur.currency_code='CDF' THEN 'FC' WHEN cur.currency_code='USD' THEN '$' ELSE cur.currency_code END AS currency_symbol,
             p.exchange_rate, p.total_amount, p.payment_status, p.payment_source, p.payment_method,
             p.total_equivalent_usd, p.amount_paid_usd, p.amount_paid_cdf, p.paid_equivalent_usd,
             p.outstanding_balance_usd, p.cash_session_id, p.payment_reference, p.payment_note,
             p.status, p.created_by, p.created_at, p.validated_at
      FROM purchases p
      JOIN suppliers sup ON sup.supplier_id = p.supplier_id AND sup.tenant_id = p.tenant_id
      JOIN sites s ON s.site_id = p.site_id AND s.tenant_id = p.tenant_id
      LEFT JOIN currencies cur ON cur.currency_id = p.currency_id
      WHERE p.tenant_id = $1 AND p.purchase_id = $2
        AND ($3::uuid IS NULL OR p.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, id, user.siteId ?? null],
    );
    if (!purchase.rows[0]) return null;
    const items = await this.findItems(user, id);
    const payments = user.permissions.includes('purchase_payments.read')
      ? await this.findPayments(user, id)
      : [];
    return { ...this.toPurchase(purchase.rows[0]), items, payments };
  }

  async create(user: AuthUser, dto: CreatePurchaseDto) {
    const currencyId = dto.currencyId ?? await this.resolveCurrencyId(dto.currencyCode) ?? await this.defaultCurrencyId();
    this.assertPaymentPermission(user, dto);
    const payment = this.computePaymentSnapshot(dto, currencyId === null ? 'USD' : await this.currencyCodeById(currencyId), dto.exchangeRate ?? 1, 0);
    await this.assertTenantRelations(user, dto.supplierId, dto.siteId, currencyId, dto.exchangeRate, dto.cashSessionId, payment);
    const number = dto.purchaseNumber?.trim() || `PUR-${Date.now()}`;
    const result = await this.db.query<PurchaseRow>(
      `
      INSERT INTO purchases (
        tenant_id, purchase_number, purchase_date, supplier_id, site_id, currency_id,
        exchange_rate, created_by, payment_status, payment_source, payment_method,
        total_equivalent_usd, amount_paid_usd, amount_paid_cdf, paid_equivalent_usd,
        outstanding_balance_usd, cash_session_id, payment_reference, payment_note
      )
      VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING purchase_id, tenant_id, purchase_number, purchase_date, supplier_id,
                NULL::text AS supplier_name, site_id, NULL::text AS site_name, currency_id,
                NULL::text AS currency_code, NULL::text AS currency_symbol,
                exchange_rate, total_amount, payment_status, payment_source, payment_method,
                total_equivalent_usd, amount_paid_usd, amount_paid_cdf, paid_equivalent_usd,
                outstanding_balance_usd, cash_session_id, payment_reference, payment_note,
                status, created_by, created_at, validated_at
      `,
      [
        user.tenantId,
        number,
        dto.purchaseDate ?? null,
        dto.supplierId,
        dto.siteId,
        currencyId,
        dto.exchangeRate ?? 1,
        user.userId,
        payment.paymentStatus,
        dto.paymentSource ?? null,
        dto.paymentMethod ?? null,
        payment.totalEquivalentUsd,
        payment.amountPaidUsd,
        payment.amountPaidCdf,
        payment.paidEquivalentUsd,
        payment.outstandingBalanceUsd,
        dto.cashSessionId ?? null,
        dto.paymentReference?.trim() || null,
        dto.paymentNote?.trim() || null,
      ],
    );
    return this.findOne(user, result.rows[0].purchase_id);
  }

  async update(user: AuthUser, id: string, dto: UpdatePurchaseDto) {
    const current = await this.findOne(user, id);
    if (!current) return null;
    if (current.status !== 'DRAFT') throw new Error('PURCHASE_NOT_DRAFT');
    this.assertPaymentPermission(user, dto);
    const supplierId = dto.supplierId ?? current.supplierId;
    const siteId = dto.siteId ?? current.siteId;
    const currencyId = dto.currencyId ?? (dto.currencyCode ? await this.resolveCurrencyId(dto.currencyCode) : current.currencyId ?? undefined);
    const currencyCode = dto.currencyCode ?? current.currencyCode ?? (currencyId ? await this.currencyCodeById(currencyId) : 'USD');
    const payment = this.computePaymentSnapshot({
      paymentStatus: dto.paymentStatus ?? current.paymentStatus,
      amountPaidUsd: dto.amountPaidUsd ?? current.amountPaidUsd,
      amountPaidCdf: dto.amountPaidCdf ?? current.amountPaidCdf,
    }, currencyCode, dto.exchangeRate ?? current.exchangeRate, current.totalAmount);
    await this.assertTenantRelations(
      user,
      supplierId,
      siteId,
      currencyId ?? undefined,
      dto.exchangeRate ?? current.exchangeRate,
      dto.cashSessionId ?? current.cashSessionId ?? undefined,
      payment,
    );
    await this.db.query(
      `
      UPDATE purchases
      SET purchase_date=COALESCE($3::date, purchase_date), supplier_id=$4, site_id=$5,
          currency_id=$6, exchange_rate=$7, payment_status=$8, payment_source=$9,
          payment_method=$10, amount_paid_usd=$11, amount_paid_cdf=$12, paid_equivalent_usd=$13,
          outstanding_balance_usd=$14, cash_session_id=$15, payment_reference=$16, payment_note=$17
      WHERE tenant_id=$1 AND purchase_id=$2
      `,
      [
        user.tenantId,
        id,
        dto.purchaseDate ?? null,
        supplierId,
        siteId,
        currencyId ?? null,
        dto.exchangeRate ?? current.exchangeRate,
        payment.paymentStatus,
        dto.paymentSource ?? current.paymentSource ?? null,
        dto.paymentMethod ?? current.paymentMethod ?? null,
        payment.amountPaidUsd,
        payment.amountPaidCdf,
        payment.paidEquivalentUsd,
        payment.outstandingBalanceUsd,
        dto.cashSessionId ?? current.cashSessionId ?? null,
        dto.paymentReference?.trim() ?? current.paymentReference ?? null,
        dto.paymentNote?.trim() ?? current.paymentNote ?? null,
      ],
    );
    return this.findOne(user, id);
  }

  async addItem(user: AuthUser, purchaseId: string, dto: AddPurchaseItemDto) {
    const purchase = await this.findOne(user, purchaseId);
    if (!purchase) return null;
    if (purchase.status !== 'DRAFT') throw new Error('PURCHASE_NOT_DRAFT');
    await this.assertArticle(user, dto.articleId);
    const purchaseCurrencyCode = purchase.currencyCode ?? 'USD';
    const purchaseQuantity = dto.purchaseQuantity ?? dto.quantity;
    const conversionFactor = dto.conversionFactor ?? 1;
    const stockQuantity = dto.stockQuantity ?? this.roundQuantity(purchaseQuantity * conversionFactor);
    if (purchaseQuantity <= 0) throw new Error('INVALID_PURCHASE_QUANTITY');
    if (conversionFactor <= 0) throw new Error('INVALID_CONVERSION_FACTOR');
    if (stockQuantity <= 0) throw new Error('INVALID_STOCK_QUANTITY');
    const unitSnapshots = await this.resolveUnitSnapshots(user, dto.articleId, dto.purchaseUnitId, dto.stockUnitId);
    const lineTotal = purchaseQuantity * dto.purchaseUnitPrice;
    await this.db.query(
      `
      INSERT INTO purchase_items (
        tenant_id, purchase_id, article_id, lot_number, expiry_date, quantity,
        purchase_unit_price, selling_unit_price, line_total, purchase_unit_id,
        purchase_unit_label_snapshot, purchase_quantity, conversion_factor, stock_unit_id,
        stock_unit_label_snapshot, stock_quantity, unit_price_currency, line_total_currency, line_order
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      `,
      [
        user.tenantId,
        purchaseId,
        dto.articleId,
        dto.lotNumber.trim(),
        dto.expiryDate,
        stockQuantity,
        dto.purchaseUnitPrice,
        dto.sellingUnitPrice,
        lineTotal,
        dto.purchaseUnitId ?? null,
        unitSnapshots.purchaseUnitLabel,
        purchaseQuantity,
        conversionFactor,
        dto.stockUnitId ?? unitSnapshots.stockUnitId,
        unitSnapshots.stockUnitLabel,
        stockQuantity,
        purchaseCurrencyCode,
        lineTotal,
        dto.lineOrder ?? await this.nextLineOrder(user, purchaseId),
      ],
    );
    await this.recalculateTotal(user, purchaseId);
    return this.findOne(user, purchaseId);
  }

  async removeItem(user: AuthUser, purchaseId: string, itemId: string) {
    const purchase = await this.findOne(user, purchaseId);
    if (!purchase) return null;
    if (purchase.status !== 'DRAFT') throw new Error('PURCHASE_NOT_DRAFT');
    await this.db.query(
      `DELETE FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2 AND purchase_item_id=$3`,
      [user.tenantId, purchaseId, itemId],
    );
    await this.recalculateTotal(user, purchaseId);
    return this.findOne(user, purchaseId);
  }

  async validate(user: AuthUser, purchaseId: string) {
    await this.db.transaction(async (client) => {
      const purchaseResult = await client.query<PurchaseRow>(
        `
        SELECT p.purchase_id, p.tenant_id, p.purchase_number, p.purchase_date, p.supplier_id,
               NULL::text AS supplier_name, p.site_id, NULL::text AS site_name, p.currency_id,
               NULL::text AS currency_code, NULL::text AS currency_symbol,
               p.exchange_rate, p.total_amount, p.payment_status, p.payment_source, p.payment_method,
               p.total_equivalent_usd, p.amount_paid_usd, p.amount_paid_cdf, p.paid_equivalent_usd,
               p.outstanding_balance_usd, p.cash_session_id, p.payment_reference, p.payment_note,
               p.status, p.created_by, p.created_at, p.validated_at
        FROM purchases p
        WHERE p.tenant_id=$1 AND p.purchase_id=$2
          AND ($3::uuid IS NULL OR p.site_id=$3::uuid)
        FOR UPDATE
        `,
        [user.tenantId, purchaseId, user.siteId ?? null],
      );
      const purchase = purchaseResult.rows[0];
      if (!purchase) throw new Error('PURCHASE_NOT_FOUND');
      if (purchase.status !== 'DRAFT') throw new Error('PURCHASE_NOT_DRAFT');

      const itemResult = await client.query<ItemRow>(
        `
        SELECT pi.purchase_item_id, pi.tenant_id, pi.purchase_id, pi.article_id,
               NULL::text AS article_code, NULL::text AS commercial_name, pi.lot_number,
               pi.expiry_date, pi.quantity, pi.purchase_unit_id, pi.purchase_unit_label_snapshot,
               pi.purchase_quantity, pi.conversion_factor, pi.stock_unit_id, pi.stock_unit_label_snapshot,
               pi.stock_quantity, pi.line_order, pi.unit_price_currency, pi.line_total_currency,
               pi.purchase_unit_price, pi.selling_unit_price, pi.line_total
        FROM purchase_items pi
        JOIN articles a ON a.article_id = pi.article_id AND a.tenant_id = pi.tenant_id
        WHERE pi.tenant_id=$1 AND pi.purchase_id=$2
        `,
        [user.tenantId, purchaseId],
      );
      if (!itemResult.rows.length) throw new Error('PURCHASE_HAS_NO_ITEMS');

      for (const item of itemResult.rows) {
        const quantity = Number(item.stock_quantity ?? item.quantity);
        if (quantity <= 0) throw new Error('INVALID_PURCHASE_QUANTITY');
        if (!item.lot_number?.trim()) throw new Error('INVALID_LOT_NUMBER');
        if (new Date(item.expiry_date) <= new Date()) throw new Error('INVALID_EXPIRY_DATE');

        const lotResult = await client.query<{ lot_id: string }>(
          `
          INSERT INTO lots (
            tenant_id, article_id, supplier_id, lot_number, expiry_date,
            purchase_price, selling_price, currency_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (article_id, lot_number) DO UPDATE
          SET purchase_price=EXCLUDED.purchase_price,
              selling_price=EXCLUDED.selling_price,
              currency_id=EXCLUDED.currency_id
          RETURNING lot_id
          `,
          [
            user.tenantId,
            item.article_id,
            purchase.supplier_id,
            item.lot_number.trim(),
            item.expiry_date,
            item.purchase_unit_price,
            item.selling_unit_price,
            purchase.currency_id,
          ],
        );
        const lotId = lotResult.rows[0].lot_id;

        await client.query(
          `
          INSERT INTO stocks (tenant_id, site_id, lot_id, quantity_available, quantity_reserved)
          VALUES ($1,$2,$3,$4,0)
          ON CONFLICT (site_id, lot_id) DO UPDATE
          SET quantity_available = stocks.quantity_available + EXCLUDED.quantity_available,
              updated_at = CURRENT_TIMESTAMP
          `,
          [user.tenantId, purchase.site_id, lotId, quantity],
        );

        await client.query(
          `
          INSERT INTO stock_movements (
            tenant_id, site_id, article_id, lot_id, movement_type, quantity,
            reference_type, reference_id, notes, user_id
          )
          VALUES ($1,$2,$3,$4,'PURCHASE_IN',$5,'PURCHASE',$6,$7,$8)
          `,
          [
            user.tenantId,
            purchase.site_id,
            item.article_id,
            lotId,
            quantity,
            purchase.purchase_id,
            `Validation achat ${purchase.purchase_number}`,
            user.userId,
          ],
        );
      }

      await this.createPurchasePaymentsAndCashMovements(client, user, purchase);

      await client.query(
        `UPDATE purchases SET status='VALIDATED', validated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND purchase_id=$2`,
        [user.tenantId, purchaseId],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1,$2,'purchases',$3,'VALIDATE',$4::jsonb)
        `,
        [
          user.tenantId,
          user.userId,
          purchaseId,
          JSON.stringify({ status: 'VALIDATED', purchaseNumber: purchase.purchase_number }),
        ],
      );
    });
    return this.findOne(user, purchaseId);
  }

  private async findItems(user: AuthUser, purchaseId: string) {
    const result = await this.db.query<ItemRow>(
      `
      SELECT pi.purchase_item_id, pi.tenant_id, pi.purchase_id, pi.article_id,
             a.article_code, a.commercial_name, pi.lot_number, pi.expiry_date,
             pi.quantity, pi.purchase_unit_id, pi.purchase_unit_label_snapshot,
             pi.purchase_quantity, pi.conversion_factor, pi.stock_unit_id, pi.stock_unit_label_snapshot,
             pi.stock_quantity, pi.line_order, pi.unit_price_currency, pi.line_total_currency,
             pi.purchase_unit_price, pi.selling_unit_price, pi.line_total
      FROM purchase_items pi
      JOIN articles a ON a.article_id = pi.article_id AND a.tenant_id = pi.tenant_id
      WHERE pi.tenant_id=$1 AND pi.purchase_id=$2
      ORDER BY COALESCE(pi.line_order, 0), pi.purchase_item_id
      `,
      [user.tenantId, purchaseId],
    );
    return result.rows.map(this.toItem);
  }

  private async findPayments(user: AuthUser, purchaseId: string) {
    const result = await this.db.query<PaymentHistoryRow>(
      `
      SELECT pp.purchase_payment_id, pp.purchase_id, pp.cash_session_id, pp.currency_code,
             pp.amount, pp.exchange_rate_applied, pp.amount_equivalent_usd, pp.payment_source,
             pp.payment_method, pp.payment_reference, pp.payment_note, pp.status, pp.created_at,
             pp.created_by, u.full_name AS created_by_name,
             cm.cash_movement_id
      FROM purchase_payments pp
      LEFT JOIN users u
        ON u.user_id = pp.created_by
       AND u.tenant_id = pp.tenant_id
      LEFT JOIN LATERAL (
        SELECT cash_movement_id
        FROM cash_movements cm
        WHERE cm.tenant_id = pp.tenant_id
          AND cm.cash_session_id IS NOT DISTINCT FROM pp.cash_session_id
          AND cm.reference_type = 'PURCHASE_PAYMENT'
          AND cm.reference_id = pp.purchase_id
          AND (
            cm.currency_id = pp.currency_id
            OR pp.currency_id IS NULL
          )
          AND cm.amount = pp.amount
        ORDER BY cm.created_at DESC NULLS LAST, cm.movement_date DESC
        LIMIT 1
      ) cm ON TRUE
      WHERE pp.tenant_id = $1
        AND pp.purchase_id = $2
        AND ($3::uuid IS NULL OR pp.site_id = $3::uuid)
      ORDER BY pp.created_at ASC, pp.purchase_payment_id ASC
      `,
      [user.tenantId, purchaseId, user.siteId ?? null],
    );
    return result.rows.map((row) => ({
      purchasePaymentId: row.purchase_payment_id,
      purchaseId: row.purchase_id,
      cashSessionId: row.cash_session_id,
      currencyCode: row.currency_code,
      amount: Number(row.amount),
      exchangeRateApplied: Number(row.exchange_rate_applied ?? 1),
      amountEquivalentUsd: Number(row.amount_equivalent_usd ?? 0),
      paymentSource: row.payment_source,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paymentNote: row.payment_note,
      status: row.status ?? 'POSTED',
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      cashMovementId: row.cash_movement_id,
    }));
  }

  private async recalculateTotal(user: AuthUser, purchaseId: string) {
    await this.db.query(
      `
      UPDATE purchases
      SET total_amount = COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0),
          total_equivalent_usd = CASE
            WHEN COALESCE((SELECT currency_code FROM currencies WHERE currency_id = purchases.currency_id LIMIT 1), 'USD') = 'CDF'
              THEN ROUND(COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0) / NULLIF(exchange_rate, 0), 2)
            ELSE COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0)
          END,
          paid_equivalent_usd = ROUND(COALESCE(amount_paid_usd, 0) + (COALESCE(amount_paid_cdf, 0) / NULLIF(exchange_rate, 0)), 2),
          outstanding_balance_usd = GREATEST(
            CASE
              WHEN COALESCE((SELECT currency_code FROM currencies WHERE currency_id = purchases.currency_id LIMIT 1), 'USD') = 'CDF'
                THEN ROUND(COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0) / NULLIF(exchange_rate, 0), 2)
              ELSE COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0)
            END - ROUND(COALESCE(amount_paid_usd, 0) + (COALESCE(amount_paid_cdf, 0) / NULLIF(exchange_rate, 0)), 2),
            0
          ),
          payment_status = CASE
            WHEN ROUND(COALESCE(amount_paid_usd, 0) + (COALESCE(amount_paid_cdf, 0) / NULLIF(exchange_rate, 0)), 2) <= 0 THEN 'UNPAID'
            WHEN ROUND(COALESCE(amount_paid_usd, 0) + (COALESCE(amount_paid_cdf, 0) / NULLIF(exchange_rate, 0)), 2) >=
              CASE
                WHEN COALESCE((SELECT currency_code FROM currencies WHERE currency_id = purchases.currency_id LIMIT 1), 'USD') = 'CDF'
                  THEN ROUND(COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0) / NULLIF(exchange_rate, 0), 2)
                ELSE COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0)
              END THEN 'PAID'
            ELSE 'PARTIALLY_PAID'
          END
      WHERE tenant_id=$1 AND purchase_id=$2
      `,
      [user.tenantId, purchaseId],
    );
  }

  private async assertTenantRelations(user: AuthUser, supplierId: string, siteId: string, currencyId?: string, exchangeRate?: number, cashSessionId?: string, payment?: { amountPaidUsd: number; amountPaidCdf: number; paymentSource?: string | null }) {
    if (user.siteId && user.siteId !== siteId) throw new Error('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ suppliers_count: string; sites_count: string; currencies_count: string }>(
      `
      SELECT
        (SELECT COUNT(*) FROM suppliers WHERE tenant_id=$1 AND supplier_id=$2 AND is_active=true)::int AS suppliers_count,
        (SELECT COUNT(*) FROM sites WHERE tenant_id=$1 AND site_id=$3 AND is_active=true)::int AS sites_count,
        (SELECT CASE WHEN $4::uuid IS NULL THEN 1 ELSE COUNT(*) END FROM currencies WHERE currency_id=$4::uuid)::int AS currencies_count
      `,
      [user.tenantId, supplierId, siteId, currencyId ?? null],
    );
    if (Number(result.rows[0]?.suppliers_count ?? 0) !== 1) throw new Error('SUPPLIER_NOT_IN_TENANT');
    if (Number(result.rows[0]?.sites_count ?? 0) !== 1) throw new Error('SITE_NOT_IN_TENANT');
    if (Number(result.rows[0]?.currencies_count ?? 0) !== 1) throw new Error('CURRENCY_NOT_FOUND');
    if (currencyId) {
      const currency = await this.db.query<{ currency_code: string }>(`SELECT currency_code FROM currencies WHERE currency_id=$1`, [currencyId]);
      if (currency.rows[0]?.currency_code === 'CDF' && (!exchangeRate || exchangeRate <= 1)) throw new Error('EXCHANGE_RATE_REQUIRED');
    }
    if (payment?.amountPaidCdf && (!exchangeRate || exchangeRate <= 0)) throw new Error('EXCHANGE_RATE_REQUIRED');
    if ((payment?.amountPaidUsd ?? 0) < 0 || (payment?.amountPaidCdf ?? 0) < 0) throw new Error('INVALID_PAYMENT_AMOUNT');
    if (payment && payment.paymentSource && payment.paymentSource !== 'CREDIT' && (payment.amountPaidUsd + payment.amountPaidCdf) <= 0) throw new Error('INVALID_PAYMENT_AMOUNT');
    if (payment?.paymentSource === 'CASH_REGISTER') {
      if (!cashSessionId) throw new Error('CASH_SESSION_REQUIRED');
      await this.assertCashSession(user, siteId, cashSessionId);
    }
  }

  private async defaultCurrencyId() {
    const result = await this.db.query<{ currency_id: string }>(
      `SELECT currency_id FROM currencies WHERE currency_code='USD' OR is_default=true ORDER BY is_default DESC LIMIT 1`,
    );
    if (!result.rows[0]) throw new Error('CURRENCY_NOT_FOUND');
    return result.rows[0].currency_id;
  }

  private async assertArticle(user: AuthUser, articleId: string) {
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM articles WHERE tenant_id=$1 AND article_id=$2 AND is_active=true`,
      [user.tenantId, articleId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('ARTICLE_NOT_IN_TENANT');
  }

  private async assertCashSession(user: AuthUser, siteId: string, cashSessionId: string) {
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM cash_sessions WHERE tenant_id=$1 AND cash_session_id=$2 AND site_id=$3 AND status='OPEN'`,
      [user.tenantId, cashSessionId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('CASH_SESSION_NOT_OPEN');
  }

  private async resolveCurrencyId(currencyCode?: string) {
    if (!currencyCode) return null;
    const result = await this.db.query<{ currency_id: string }>(`SELECT currency_id FROM currencies WHERE currency_code=$1 LIMIT 1`, [currencyCode.toUpperCase()]);
    return result.rows[0]?.currency_id ?? null;
  }

  private async currencyCodeById(currencyId: string) {
    const result = await this.db.query<{ currency_code: string }>(`SELECT currency_code FROM currencies WHERE currency_id=$1 LIMIT 1`, [currencyId]);
    return result.rows[0]?.currency_code ?? 'USD';
  }

  private roundQuantity(value: number) {
    return Math.round(value * 1000) / 1000;
  }

  private async nextLineOrder(user: AuthUser, purchaseId: string) {
    const result = await this.db.query<{ next_order: string }>(
      `SELECT COALESCE(MAX(line_order), -1) + 1 AS next_order FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2`,
      [user.tenantId, purchaseId],
    );
    return Number(result.rows[0]?.next_order ?? 0);
  }

  private async resolveUnitSnapshots(user: AuthUser, articleId: string, purchaseUnitId?: string, stockUnitId?: string) {
    const article = await this.db.query<{ sales_unit_id: string | null; packaging_unit_id: string | null; units_per_package: string | null; packaging: string | null }>(
      `SELECT sales_unit_id, packaging_unit_id, units_per_package, packaging FROM articles WHERE tenant_id=$1 AND article_id=$2 LIMIT 1`,
      [user.tenantId, articleId],
    );
    const current = article.rows[0];
    const resolvedStockUnitId = stockUnitId ?? current?.sales_unit_id ?? current?.packaging_unit_id ?? null;
    const purchaseLabel = purchaseUnitId ? await this.unitLabel(user, purchaseUnitId) : current?.packaging ?? await this.unitLabel(user, current?.packaging_unit_id ?? '');
    const stockLabel = resolvedStockUnitId ? await this.unitLabel(user, resolvedStockUnitId) : current?.packaging ?? 'Unite';
    return {
      purchaseUnitLabel: purchaseLabel || current?.packaging || 'Unite',
      stockUnitId: resolvedStockUnitId,
      stockUnitLabel: stockLabel || 'Unite',
    };
  }

  private async unitLabel(user: AuthUser, productUnitId: string) {
    if (!productUnitId) return null;
    const result = await this.db.query<{ unit_label: string }>(
      `SELECT unit_label FROM product_units WHERE tenant_id=$1 AND product_unit_id=$2 LIMIT 1`,
      [user.tenantId, productUnitId],
    );
    return result.rows[0]?.unit_label ?? null;
  }

  private computePaymentSnapshot(
    dto: {
      paymentStatus?: string | null;
      amountPaidUsd?: number | null;
      amountPaidCdf?: number | null;
      paymentSource?: string | null;
    },
    currencyCode: string,
    exchangeRate: number,
    totalAmount: number,
  ) {
    const amountPaidUsd = Number(dto.amountPaidUsd ?? 0);
    const amountPaidCdf = Number(dto.amountPaidCdf ?? 0);
    const totalEquivalentUsd = currencyCode === 'CDF' ? Number((totalAmount / Math.max(exchangeRate || 1, 1)).toFixed(2)) : totalAmount;
    const paidEquivalentUsd = Number((amountPaidUsd + (amountPaidCdf / Math.max(exchangeRate || 1, 1))).toFixed(2));
    const outstandingBalanceUsd = Number(Math.max(totalEquivalentUsd - paidEquivalentUsd, 0).toFixed(2));
    const paymentStatus =
      dto.paymentStatus
      ?? (paidEquivalentUsd <= 0 ? 'UNPAID' : outstandingBalanceUsd <= 0 ? 'PAID' : 'PARTIALLY_PAID');
    return { amountPaidUsd, amountPaidCdf, totalEquivalentUsd, paidEquivalentUsd, outstandingBalanceUsd, paymentStatus, paymentSource: dto.paymentSource ?? null };
  }

  private assertPaymentPermission(
    user: AuthUser,
    dto: {
      paymentStatus?: string | null;
      paymentSource?: string | null;
      paymentMethod?: string | null;
      amountPaidUsd?: number | null;
      amountPaidCdf?: number | null;
      cashSessionId?: string | null;
      paymentReference?: string | null;
      paymentNote?: string | null;
    },
  ) {
    const usesPaymentFields = Boolean(
      (dto.amountPaidUsd ?? 0) > 0
      || (dto.amountPaidCdf ?? 0) > 0
      || dto.cashSessionId
      || (dto.paymentSource && dto.paymentSource !== 'CREDIT')
      || (dto.paymentMethod && dto.paymentMethod !== 'CREDIT')
      || (dto.paymentStatus && dto.paymentStatus !== 'UNPAID')
      || dto.paymentReference?.trim()
      || dto.paymentNote?.trim(),
    );
    if (usesPaymentFields && !user.permissions.includes('purchases.pay')) throw new Error('PERMISSION_DENIED');
  }

  private async createPurchasePaymentsAndCashMovements(client: any, user: AuthUser, purchase: PurchaseRow) {
    const amountPaidUsd = Number(purchase.amount_paid_usd ?? 0);
    const amountPaidCdf = Number(purchase.amount_paid_cdf ?? 0);
    if (amountPaidUsd <= 0 && amountPaidCdf <= 0) return;

    const existing = await client.query(
      `SELECT COUNT(*)::int AS total FROM purchase_payments WHERE tenant_id=$1 AND purchase_id=$2`,
      [user.tenantId, purchase.purchase_id],
    );
    if (Number(existing.rows[0]?.total ?? 0) > 0) return;

    const usdCurrencyId = await this.currencyIdByCode(client, 'USD');
    const cdfCurrencyId = await this.currencyIdByCode(client, 'CDF');
    const entries = [
      amountPaidUsd > 0 ? { currencyCode: 'USD', currencyId: usdCurrencyId, amount: amountPaidUsd, equivalentUsd: amountPaidUsd } : null,
      amountPaidCdf > 0 ? { currencyCode: 'CDF', currencyId: cdfCurrencyId, amount: amountPaidCdf, equivalentUsd: Number((amountPaidCdf / Math.max(Number(purchase.exchange_rate), 1)).toFixed(2)) } : null,
    ].filter(Boolean) as Array<{ currencyCode: string; currencyId: string | null; amount: number; equivalentUsd: number }>;

    for (const entry of entries) {
      await client.query(
        `INSERT INTO purchase_payments (
          tenant_id, site_id, purchase_id, cash_session_id, currency_id, currency_code, amount,
          exchange_rate_applied, amount_equivalent_usd, payment_source, payment_method,
          payment_reference, payment_note, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          user.tenantId,
          purchase.site_id,
          purchase.purchase_id,
          purchase.cash_session_id,
          entry.currencyId,
          entry.currencyCode,
          entry.amount,
          Number(purchase.exchange_rate),
          entry.equivalentUsd,
          purchase.payment_source ?? 'OTHER',
          purchase.payment_method ?? null,
          purchase.payment_reference ?? null,
          purchase.payment_note ?? null,
          user.userId,
        ],
      );

      if (purchase.payment_source === 'CASH_REGISTER' && purchase.cash_session_id) {
        await client.query(
          `INSERT INTO cash_movements (
            tenant_id, cash_session_id, movement_type, amount, currency_id, reference_type, reference_id, description, created_by
          ) VALUES ($1,$2,'EXPENSE',$3,$4,'PURCHASE_PAYMENT',$5,$6,$7)`,
          [
            user.tenantId,
            purchase.cash_session_id,
            entry.amount,
            entry.currencyId,
            purchase.purchase_id,
            `Paiement achat ${purchase.purchase_number}`,
            user.userId,
          ],
        );
      }
    }
  }

  private async currencyIdByCode(client: any, code: string) {
    const result = await client.query(`SELECT currency_id FROM currencies WHERE currency_code=$1 LIMIT 1`, [code]);
    return result.rows[0]?.currency_id ?? null;
  }

  private toPurchase(row: PurchaseRow) {
    return {
      purchaseId: row.purchase_id,
      tenantId: row.tenant_id,
      purchaseNumber: row.purchase_number,
      purchaseDate: row.purchase_date,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      siteId: row.site_id,
      siteName: row.site_name,
      currencyId: row.currency_id,
      currencyCode: row.currency_code,
      currencySymbol: row.currency_symbol,
      exchangeRate: Number(row.exchange_rate),
      totalAmount: Number(row.total_amount),
      paymentStatus: row.payment_status ?? 'UNPAID',
      paymentSource: row.payment_source,
      paymentMethod: row.payment_method,
      totalEquivalentUsd: Number(row.total_equivalent_usd ?? 0),
      amountPaidUsd: Number(row.amount_paid_usd ?? 0),
      amountPaidCdf: Number(row.amount_paid_cdf ?? 0),
      paidEquivalentUsd: Number(row.paid_equivalent_usd ?? 0),
      outstandingBalanceUsd: Number(row.outstanding_balance_usd ?? 0),
      cashSessionId: row.cash_session_id,
      paymentReference: row.payment_reference,
      paymentNote: row.payment_note,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      validatedAt: row.validated_at,
    };
  }

  private toItem(row: ItemRow) {
    return {
      purchaseItemId: row.purchase_item_id,
      purchaseId: row.purchase_id,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date,
      quantity: Number(row.quantity),
      purchaseUnitId: row.purchase_unit_id,
      purchaseUnitLabelSnapshot: row.purchase_unit_label_snapshot,
      purchaseQuantity: Number(row.purchase_quantity ?? row.quantity),
      conversionFactor: Number(row.conversion_factor ?? 1),
      stockUnitId: row.stock_unit_id,
      stockUnitLabelSnapshot: row.stock_unit_label_snapshot,
      stockQuantity: Number(row.stock_quantity ?? row.quantity),
      lineOrder: row.line_order ?? 0,
      unitPriceCurrency: row.unit_price_currency,
      lineTotalCurrency: Number(row.line_total_currency ?? row.line_total),
      purchaseUnitPrice: Number(row.purchase_unit_price),
      sellingUnitPrice: Number(row.selling_unit_price),
      lineTotal: Number(row.line_total),
    };
  }
}
