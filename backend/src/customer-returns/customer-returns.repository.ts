import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { AddCustomerReturnItemDto } from './dto/add-customer-return-item.dto';
import { AddCustomerReturnReplacementItemDto } from './dto/add-customer-return-replacement-item.dto';
import { AddCustomerReturnSettlementDto } from './dto/add-customer-return-settlement.dto';
import { CreateCustomerReturnDto } from './dto/create-customer-return.dto';
import { InspectCustomerReturnDto } from './dto/inspect-customer-return.dto';
import { ListCustomerReturnsDto } from './dto/list-customer-returns.dto';

type Queryable = { query: DatabaseService['query'] };

type CustomerReturnRow = {
  customer_return_id: string;
  tenant_id: string;
  site_id: string;
  site_name: string | null;
  sale_id: string;
  sale_number_snapshot: string;
  sale_date_snapshot: Date;
  sale_type_snapshot: string;
  customer_id: string | null;
  customer_name_snapshot: string | null;
  organization_id: string | null;
  organization_name_snapshot: string | null;
  membership_id: string | null;
  site_name_snapshot: string;
  currency_code: string;
  exchange_rate_snapshot: string;
  return_number: string;
  return_date: Date;
  status: string;
  reason: string | null;
  note: string | null;
  inspection_note: string | null;
  returned_value_usd: string;
  replacement_value_usd: string;
  financial_difference_usd: string;
  refund_due_usd: string;
  additional_payment_due_usd: string;
  customer_credit_usd: string;
  refunded_amount_usd: string;
  additional_paid_usd: string;
  created_by: string | null;
  inspected_by: string | null;
  validated_by: string | null;
  created_at: Date;
  inspected_at: Date | null;
  validated_at: Date | null;
  cancelled_at: Date | null;
  items_count?: string;
  total_count?: string;
};

type CustomerReturnItemRow = {
  customer_return_item_id: string;
  customer_return_id: string;
  sale_id: string;
  sale_item_id: string;
  article_id: string;
  article_code_snapshot: string | null;
  commercial_name_snapshot: string | null;
  lot_id: string | null;
  lot_number_snapshot: string | null;
  expiry_date_snapshot: Date | null;
  sale_quantity: string;
  returned_quantity: string;
  condition_status: string;
  note: string | null;
  unit_price_snapshot: string;
  line_return_value: string;
  sales_unit_snapshot: string | null;
  packaging_snapshot: string | null;
  created_at: Date;
};

type CustomerReturnReplacementRow = {
  customer_return_replacement_item_id: string;
  customer_return_id: string;
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  sales_unit_id: string | null;
  sales_unit_snapshot: string | null;
  packaging_snapshot: string | null;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  line_total: string;
  created_by: string | null;
  created_at: Date;
};

type CustomerReturnSettlementRow = {
  customer_return_settlement_id: string;
  customer_return_id: string;
  customer_id: string | null;
  settlement_kind: string;
  payment_source: string;
  currency_code: string;
  exchange_rate_applied: string;
  amount: string;
  amount_equivalent_usd: string;
  cash_session_id: string | null;
  expiration_date: Date | null;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: Date;
};

type CustomerCreditRow = {
  customer_credit_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_return_id: string | null;
  currency_code: string;
  initial_amount: string;
  remaining_amount: string;
  exchange_rate_applied: string;
  status: string;
  expiration_date: Date | null;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: Date;
  used_at: Date | null;
  cancelled_at: Date | null;
};

type CustomerReturnFinancialSnapshot = {
  returnedValueUsd: number;
  replacementValueUsd: number;
  financialDifferenceUsd: number;
  refundDueUsd: number;
  additionalPaymentDueUsd: number;
  customerCreditUsd: number;
  refundedAmountUsd: number;
  additionalPaidUsd: number;
};

type ArticleForReplacement = {
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  packaging: string | null;
  sales_unit_id: string | null;
  selling_price: string | null;
};

export type CustomerReturnSaleItem = {
  saleItemId: string;
  articleId: string;
  articleCode?: string | null;
  commercialName?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | Date | null;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  salesUnitSnapshot?: string | null;
  packagingSnapshot?: string | null;
};

@Injectable()
export class CustomerReturnsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser, query: ListCustomerReturnsDto) {
    const params: unknown[] = [user.tenantId, user.siteId ?? null];
    const filters = ['cr.tenant_id = $1', '($2::uuid IS NULL OR cr.site_id = $2::uuid)'];

    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      filters.push(`(
        cr.return_number ILIKE $${params.length}
        OR cr.sale_number_snapshot ILIKE $${params.length}
        OR COALESCE(cr.customer_name_snapshot, '') ILIKE $${params.length}
        OR COALESCE(cr.organization_name_snapshot, '') ILIKE $${params.length}
      )`);
    }

    if (query.status?.trim()) {
      params.push(query.status.trim());
      filters.push(`cr.status = $${params.length}`);
    }

    if (query.siteId) {
      params.push(query.siteId);
      filters.push(`cr.site_id = $${params.length}::uuid`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      filters.push(`cr.return_date >= $${params.length}::date`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      filters.push(`cr.return_date < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const sortColumn = query.sortBy === 'createdAt' ? 'cr.created_at' : 'cr.return_date';
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limit = query.limit ?? 25;
    const offset = ((query.page ?? 1) - 1) * limit;
    params.push(limit, offset);

    const result = await this.db.query<CustomerReturnRow>(
      `
      WITH filtered AS (
        SELECT
          cr.customer_return_id, cr.tenant_id, cr.site_id, s.site_name, cr.sale_id,
          cr.sale_number_snapshot, cr.sale_date_snapshot, cr.sale_type_snapshot,
          cr.customer_id, cr.customer_name_snapshot, cr.organization_id, cr.organization_name_snapshot,
          cr.membership_id, cr.site_name_snapshot, cr.currency_code, cr.exchange_rate_snapshot,
          cr.return_number, cr.return_date, cr.status, cr.reason, cr.note, cr.inspection_note,
          cr.returned_value_usd, cr.replacement_value_usd, cr.financial_difference_usd,
          cr.refund_due_usd, cr.additional_payment_due_usd, cr.customer_credit_usd,
          cr.refunded_amount_usd, cr.additional_paid_usd,
          cr.created_by, cr.inspected_by, cr.validated_by, cr.created_at, cr.inspected_at,
          cr.validated_at, cr.cancelled_at,
          COUNT(*) OVER()::int AS total_count,
          (
            SELECT COUNT(*)::int
            FROM customer_return_items cri
            WHERE cri.tenant_id = cr.tenant_id
              AND cri.customer_return_id = cr.customer_return_id
          ) AS items_count
        FROM customer_returns cr
        LEFT JOIN sites s ON s.site_id = cr.site_id AND s.tenant_id = cr.tenant_id
        WHERE ${filters.join(' AND ')}
      )
      SELECT *
      FROM filtered
      ORDER BY ${sortColumn} ${sortOrder}, filtered.created_at DESC, filtered.customer_return_id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
      `,
      params,
    );

    return {
      items: result.rows.map((row) => this.toReturn(row)),
      page: query.page ?? 1,
      limit,
      total: Number(result.rows[0]?.total_count ?? 0),
      totalPages: Math.max(1, Math.ceil(Number(result.rows[0]?.total_count ?? 0) / limit)),
    };
  }

  async findOne(user: AuthUser, id: string) {
    const result = await this.db.query<CustomerReturnRow>(
      `
      SELECT
        cr.customer_return_id, cr.tenant_id, cr.site_id, s.site_name, cr.sale_id,
        cr.sale_number_snapshot, cr.sale_date_snapshot, cr.sale_type_snapshot,
        cr.customer_id, cr.customer_name_snapshot, cr.organization_id, cr.organization_name_snapshot,
        cr.membership_id, cr.site_name_snapshot, cr.currency_code, cr.exchange_rate_snapshot,
        cr.return_number, cr.return_date, cr.status, cr.reason, cr.note, cr.inspection_note,
        cr.returned_value_usd, cr.replacement_value_usd, cr.financial_difference_usd,
        cr.refund_due_usd, cr.additional_payment_due_usd, cr.customer_credit_usd,
        cr.refunded_amount_usd, cr.additional_paid_usd,
        cr.created_by, cr.inspected_by, cr.validated_by, cr.created_at, cr.inspected_at,
        cr.validated_at, cr.cancelled_at
      FROM customer_returns cr
      LEFT JOIN sites s ON s.site_id = cr.site_id AND s.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = $1
        AND cr.customer_return_id = $2::uuid
        AND ($3::uuid IS NULL OR cr.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, id, user.siteId ?? null],
    );
    if (!result.rows[0]) return null;
    const header = this.toReturn(result.rows[0]);
    return {
      ...header,
      items: await this.findItems(this.db, user.tenantId, id),
      replacementItems: await this.findReplacementItems(this.db, user.tenantId, id),
      settlements: await this.findSettlements(this.db, user.tenantId, id),
      customerCredits: await this.findCreditsByReturn(this.db, user.tenantId, id),
    };
  }

  async create(user: AuthUser, dto: CreateCustomerReturnDto, sale: any) {
    return this.db.transaction(async (client) => {
      const returnNumber = dto.returnNumber?.trim() || await this.nextReturnNumber(client, user.tenantId);
      const inserted = await client.query<{ customer_return_id: string }>(
        `
        INSERT INTO customer_returns (
          tenant_id, site_id, sale_id, customer_id, organization_id, membership_id,
          return_number, return_date, sale_number_snapshot, sale_date_snapshot, sale_type_snapshot,
          customer_name_snapshot, organization_name_snapshot, site_name_snapshot,
          currency_code, exchange_rate_snapshot, reason, note, created_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,COALESCE($8::date, CURRENT_DATE),$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        )
        RETURNING customer_return_id
        `,
        [
          user.tenantId,
          sale.siteId,
          sale.saleId,
          sale.customerId ?? null,
          sale.organizationId ?? null,
          sale.membershipId ?? null,
          returnNumber,
          dto.returnDate ?? null,
          sale.saleNumber,
          this.toCivilDate(sale.saleDate),
          sale.saleType,
          sale.customerName ?? null,
          sale.organizationName ?? null,
          sale.siteName ?? null,
          sale.currencyCode ?? 'USD',
          Number(sale.exchangeRate ?? 1),
          dto.reason?.trim() || null,
          dto.note?.trim() || null,
          user.userId,
        ],
      );
      await this.insertAudit(client, user, inserted.rows[0].customer_return_id, 'CUSTOMER_RETURN_CREATED', {
        saleId: sale.saleId,
        returnNumber,
      });
      return inserted.rows[0].customer_return_id;
    });
  }

  async addItem(user: AuthUser, customerReturnId: string, dto: AddCustomerReturnItemDto, saleItem: CustomerReturnSaleItem, availableQuantity: number, saleId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'DRAFT') throw new Error('CUSTOMER_RETURN_NOT_DRAFT');
      if (current.sale_id !== saleId) throw new Error('CUSTOMER_RETURN_SALE_MISMATCH');

      const duplicate = await client.query<{ customer_return_item_id: string }>(
        `
        SELECT customer_return_item_id
        FROM customer_return_items
        WHERE tenant_id = $1
          AND customer_return_id = $2::uuid
          AND sale_item_id = $3::uuid
        LIMIT 1
        `,
        [user.tenantId, customerReturnId, dto.saleItemId],
      );
      if (duplicate.rows[0]) throw new Error('CUSTOMER_RETURN_ITEM_ALREADY_EXISTS');

      if (Number(dto.returnedQuantity) > availableQuantity) throw new Error('RETURN_QUANTITY_EXCEEDS_AVAILABLE');

      const unitPriceSnapshot = Number(saleItem.unitPrice ?? 0);
      const lineReturnValue = this.roundMoney(Number(dto.returnedQuantity) * unitPriceSnapshot);

      await client.query(
        `
        INSERT INTO customer_return_items (
          tenant_id, customer_return_id, sale_id, sale_item_id, article_id, lot_id,
          article_code_snapshot, commercial_name_snapshot, lot_number_snapshot, expiry_date_snapshot,
          sale_quantity, returned_quantity, condition_status, note,
          unit_price_snapshot, line_return_value, sales_unit_snapshot, packaging_snapshot
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        `,
        [
          user.tenantId,
          customerReturnId,
          saleId,
          saleItem.saleItemId,
          saleItem.articleId,
          saleItem.lotId ?? null,
          saleItem.articleCode ?? null,
          saleItem.commercialName ?? null,
          saleItem.lotNumber ?? null,
          this.toCivilDate(saleItem.expiryDate),
          Number(saleItem.quantity ?? 0),
          Number(dto.returnedQuantity),
          dto.conditionStatus ?? 'GOOD',
          dto.note?.trim() || null,
          unitPriceSnapshot,
          lineReturnValue,
          saleItem.salesUnitSnapshot ?? null,
          saleItem.packagingSnapshot ?? null,
        ],
      );
      await this.syncFinancials(user.tenantId, customerReturnId, client);
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', {
        action: 'ADD_ITEM',
        saleItemId: dto.saleItemId,
        returnedQuantity: dto.returnedQuantity,
      });
      return { ok: true };
    });
  }

  async removeItem(user: AuthUser, customerReturnId: string, itemId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'DRAFT') throw new Error('CUSTOMER_RETURN_NOT_DRAFT');

      const removed = await client.query(
        `DELETE FROM customer_return_items WHERE tenant_id = $1 AND customer_return_id = $2::uuid AND customer_return_item_id = $3::uuid`,
        [user.tenantId, customerReturnId, itemId],
      );
      if ((removed.rowCount ?? 0) === 0) throw new Error('CUSTOMER_RETURN_ITEM_NOT_FOUND');
      await this.syncFinancials(user.tenantId, customerReturnId, client);
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', {
        action: 'REMOVE_ITEM',
        customerReturnItemId: itemId,
      });
      return { deleted: true };
    });
  }

  async submitForInspection(user: AuthUser, customerReturnId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'DRAFT') throw new Error('CUSTOMER_RETURN_NOT_DRAFT');
      const items = await this.findItems(client, user.tenantId, customerReturnId);
      if (!items.length) throw new Error('CUSTOMER_RETURN_EMPTY');

      await client.query(
        `UPDATE customer_returns SET status = 'PENDING_INSPECTION' WHERE tenant_id = $1 AND customer_return_id = $2::uuid`,
        [user.tenantId, customerReturnId],
      );
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', { action: 'SUBMIT_INSPECTION' });
      return { submitted: true };
    });
  }

  async inspect(user: AuthUser, customerReturnId: string, dto: InspectCustomerReturnDto) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'PENDING_INSPECTION') throw new Error('CUSTOMER_RETURN_NOT_PENDING_INSPECTION');

      const nextStatus = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
      await client.query(
        `
        UPDATE customer_returns
        SET status = $3,
            inspection_note = $4,
            inspected_by = $5,
            inspected_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND customer_return_id = $2::uuid
        `,
        [user.tenantId, customerReturnId, nextStatus, dto.note?.trim() || null, user.userId],
      );
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', {
        action: 'INSPECT',
        decision: nextStatus,
        note: dto.note ?? null,
      });
      return { inspected: true, status: nextStatus };
    });
  }

  async addReplacementItem(user: AuthUser, customerReturnId: string, dto: AddCustomerReturnReplacementItemDto) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'APPROVED') throw new Error('CUSTOMER_RETURN_NOT_APPROVED');

      const article = await this.assertArticle(user.tenantId, dto.articleId);
      const salesUnitSnapshot = dto.salesUnitId
        ? await this.unitLabel(user.tenantId, dto.salesUnitId)
        : await this.unitLabel(user.tenantId, article.sales_unit_id ?? '');
      const quantity = Number(dto.quantity);
      const unitPrice = Number(dto.unitPrice);
      const discountAmount = Number(dto.discountAmount ?? 0);
      const lineTotal = this.roundMoney((quantity * unitPrice) - discountAmount);
      if (lineTotal < 0) throw new Error('INVALID_SETTLEMENT_AMOUNT');

      await client.query(
        `
        INSERT INTO customer_return_replacement_items (
          tenant_id, customer_return_id, article_id, sales_unit_id, sales_unit_snapshot,
          packaging_snapshot, quantity, unit_price, discount_amount, line_total, created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
        [
          user.tenantId,
          customerReturnId,
          dto.articleId,
          dto.salesUnitId ?? article.sales_unit_id ?? null,
          salesUnitSnapshot,
          article.packaging ?? null,
          quantity,
          unitPrice,
          discountAmount,
          lineTotal,
          user.userId,
        ],
      );
      await this.syncFinancials(user.tenantId, customerReturnId, client);
      await this.insertAudit(client, user, customerReturnId, 'CUSTOMER_EXCHANGE', {
        articleId: dto.articleId,
        quantity,
        unitPrice,
        discountAmount,
      });
      return { ok: true };
    });
  }

  async removeReplacementItem(user: AuthUser, customerReturnId: string, replacementItemId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'APPROVED') throw new Error('CUSTOMER_RETURN_NOT_APPROVED');

      await client.query(
        `DELETE FROM customer_return_replacement_items WHERE tenant_id = $1 AND customer_return_id = $2::uuid AND customer_return_replacement_item_id = $3::uuid`,
        [user.tenantId, customerReturnId, replacementItemId],
      );
      await this.syncFinancials(user.tenantId, customerReturnId, client);
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', {
        action: 'REMOVE_REPLACEMENT',
        customerReturnReplacementItemId: replacementItemId,
      });
      return { deleted: true };
    });
  }

  async addSettlement(user: AuthUser, customerReturnId: string, dto: AddCustomerReturnSettlementDto) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'APPROVED') throw new Error('CUSTOMER_RETURN_NOT_APPROVED');
      if (!current.customer_id && dto.settlementKind === 'CUSTOMER_CREDIT') throw new Error('CUSTOMER_REQUIRED_FOR_CREDIT');

      const amount = Number(dto.amount);
      if (amount <= 0) throw new Error('INVALID_SETTLEMENT_AMOUNT');
      const currencyCode = (dto.currencyCode ?? current.currency_code ?? 'USD').toUpperCase();
      const exchangeRate = Number(dto.exchangeRateApplied ?? current.exchange_rate_snapshot ?? 1);
      if (currencyCode === 'CDF' && exchangeRate <= 1) throw new Error('EXCHANGE_RATE_REQUIRED');
      if (dto.paymentSource === 'CASH_REGISTER') {
        if (!dto.cashSessionId) throw new Error('CASH_SESSION_REQUIRED');
        await this.assertCashSession(user, current.site_id, dto.cashSessionId);
      }
      if (dto.settlementKind === 'CUSTOMER_CREDIT' && dto.paymentSource !== 'CUSTOMER_CREDIT') throw new Error('CUSTOMER_CREDIT_SOURCE_REQUIRED');
      const amountEquivalentUsd = this.toUsd(amount, currencyCode, exchangeRate);

      await client.query(
        `
        INSERT INTO customer_return_settlements (
          tenant_id, site_id, customer_return_id, customer_id, settlement_kind, payment_source,
          currency_code, exchange_rate_applied, amount, amount_equivalent_usd, cash_session_id,
          expiration_date, reference, note, created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `,
        [
          user.tenantId,
          current.site_id,
          customerReturnId,
          current.customer_id,
          dto.settlementKind,
          dto.paymentSource,
          currencyCode,
          exchangeRate,
          amount,
          amountEquivalentUsd,
          dto.cashSessionId ?? null,
          this.toCivilDate(dto.expirationDate),
          dto.reference?.trim() || null,
          dto.note?.trim() || null,
          user.userId,
        ],
      );
      await this.syncFinancials(user.tenantId, customerReturnId, client);
      await this.insertAudit(client, user, customerReturnId, dto.settlementKind === 'REFUND' ? 'CUSTOMER_REFUND' : dto.settlementKind === 'CUSTOMER_CREDIT' ? 'CUSTOMER_CREDIT_CREATED' : 'CUSTOMER_EXCHANGE_PAYMENT', {
        settlementKind: dto.settlementKind,
        paymentSource: dto.paymentSource,
        amount,
        currencyCode,
      });
      return { ok: true };
    });
  }

  async removeSettlement(user: AuthUser, customerReturnId: string, settlementId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'APPROVED') throw new Error('CUSTOMER_RETURN_NOT_APPROVED');

      await client.query(
        `DELETE FROM customer_return_settlements WHERE tenant_id = $1 AND customer_return_id = $2::uuid AND customer_return_settlement_id = $3::uuid`,
        [user.tenantId, customerReturnId, settlementId],
      );
      await this.syncFinancials(user.tenantId, customerReturnId, client);
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', {
        action: 'REMOVE_SETTLEMENT',
        customerReturnSettlementId: settlementId,
      });
      return { deleted: true };
    });
  }

  async validate(user: AuthUser, customerReturnId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null, true);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'APPROVED') throw new Error('CUSTOMER_RETURN_NOT_APPROVED');

      const items = await this.findItems(client, user.tenantId, customerReturnId);
      if (!items.length) throw new Error('CUSTOMER_RETURN_EMPTY');

      const settlements = await this.findSettlements(client, user.tenantId, customerReturnId);
      const snapshot = await this.syncFinancials(user.tenantId, customerReturnId, client);
      if (snapshot.refundDueUsd > 0.01 || snapshot.additionalPaymentDueUsd > 0.01) {
        throw new Error('CUSTOMER_RETURN_SETTLEMENT_REQUIRED');
      }

      for (const settlement of settlements) {
        if (settlement.paymentSource !== 'CASH_REGISTER' || !settlement.cashSessionId) continue;
        if (settlement.settlementKind === 'REFUND') {
          await client.query(
            `
            INSERT INTO cash_movements (
              tenant_id, cash_session_id, movement_type, amount, currency_id,
              reference_type, reference_id, description, created_by
            )
            VALUES (
              $1,$2,'CUSTOMER_REFUND',$3,
              (SELECT currency_id FROM currencies WHERE currency_code = $4 LIMIT 1),
              'CUSTOMER_RETURN',$5,$6,$7
            )
            `,
            [
              user.tenantId,
              settlement.cashSessionId,
              settlement.amount,
              settlement.currencyCode,
              customerReturnId,
              `Remboursement retour client ${current.return_number}`,
              user.userId,
            ],
          );
        }
        if (settlement.settlementKind === 'ADDITIONAL_PAYMENT') {
          await client.query(
            `
            INSERT INTO cash_movements (
              tenant_id, cash_session_id, movement_type, amount, currency_id,
              reference_type, reference_id, description, created_by
            )
            VALUES (
              $1,$2,'CUSTOMER_EXCHANGE_PAYMENT',$3,
              (SELECT currency_id FROM currencies WHERE currency_code = $4 LIMIT 1),
              'CUSTOMER_RETURN',$5,$6,$7
            )
            `,
            [
              user.tenantId,
              settlement.cashSessionId,
              settlement.amount,
              settlement.currencyCode,
              customerReturnId,
              `Complement retour client ${current.return_number}`,
              user.userId,
            ],
          );
        }
      }

      for (const settlement of settlements.filter((entry) => entry.settlementKind === 'CUSTOMER_CREDIT')) {
        if (!current.customer_id) throw new Error('CUSTOMER_REQUIRED_FOR_CREDIT');
        await client.query(
          `
          INSERT INTO customer_credits (
            tenant_id, site_id, customer_id, customer_return_id, currency_code,
            initial_amount, remaining_amount, exchange_rate_applied, status,
            expiration_date, reference, note, created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$6,$7,'AVAILABLE',$8,$9,$10,$11)
          `,
          [
            user.tenantId,
            current.site_id,
            current.customer_id,
            customerReturnId,
            settlement.currencyCode,
            settlement.amount,
            settlement.exchangeRateApplied,
            this.toCivilDate(settlement.expirationDate),
            settlement.reference ?? null,
            settlement.note ?? null,
            settlement.createdBy ?? user.userId,
          ],
        );
      }

      await client.query(
        `
        UPDATE customer_returns
        SET status = 'VALIDATED',
            validated_by = $3,
            validated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND customer_return_id = $2::uuid
        `,
        [user.tenantId, customerReturnId, user.userId],
      );
      await this.insertAudit(client, user, customerReturnId, 'VALIDATE', {
        status: 'VALIDATED',
        financials: snapshot,
      });
      return { validated: true };
    });
  }

  async cancel(user: AuthUser, customerReturnId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status === 'VALIDATED') throw new Error('CUSTOMER_RETURN_ALREADY_VALIDATED');

      await client.query(
        `
        UPDATE customer_returns
        SET status = 'CANCELLED',
            cancelled_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND customer_return_id = $2::uuid
        `,
        [user.tenantId, customerReturnId],
      );
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', { action: 'CANCEL' });
      return { cancelled: true };
    });
  }

  async findReturnedQuantitiesBySale(user: AuthUser, saleId: string) {
    const result = await this.db.query<{ sale_item_id: string; total_returned: string }>(
      `
      SELECT cri.sale_item_id, COALESCE(SUM(cri.returned_quantity), 0)::numeric AS total_returned
      FROM customer_return_items cri
      JOIN customer_returns cr ON cr.customer_return_id = cri.customer_return_id
      WHERE cri.tenant_id = $1
        AND cr.sale_id = $2::uuid
        AND cr.status NOT IN ('CANCELLED', 'REJECTED')
      GROUP BY cri.sale_item_id
      `,
      [user.tenantId, saleId],
    );
    return new Map(result.rows.map((row) => [row.sale_item_id, Number(row.total_returned)]));
  }

  async findCustomerCredits(user: AuthUser, customerId?: string) {
    const params: unknown[] = [user.tenantId, user.siteId ?? null, customerId ?? null];
    const result = await this.db.query<CustomerCreditRow>(
      `
      SELECT
        cc.customer_credit_id, cc.customer_id, c.customer_name, cc.customer_return_id,
        cc.currency_code, cc.initial_amount, cc.remaining_amount, cc.exchange_rate_applied,
        cc.status, cc.expiration_date, cc.reference, cc.note, cc.created_by, cc.created_at,
        cc.used_at, cc.cancelled_at
      FROM customer_credits cc
      JOIN customers c ON c.customer_id = cc.customer_id AND c.tenant_id = cc.tenant_id
      WHERE cc.tenant_id = $1
        AND ($2::uuid IS NULL OR cc.site_id = $2::uuid)
        AND ($3::uuid IS NULL OR cc.customer_id = $3::uuid)
      ORDER BY cc.created_at DESC, cc.customer_credit_id DESC
      `,
      params,
    );
    return result.rows.map((row) => this.toCustomerCredit(row));
  }

  private async findItems(queryable: Queryable, tenantId: string, customerReturnId: string) {
    const result = await queryable.query<CustomerReturnItemRow>(
      `
      SELECT
        cri.customer_return_item_id, cri.customer_return_id, cri.sale_id, cri.sale_item_id, cri.article_id,
        cri.article_code_snapshot, cri.commercial_name_snapshot, cri.lot_id, cri.lot_number_snapshot,
        cri.expiry_date_snapshot, cri.sale_quantity, cri.returned_quantity, cri.condition_status,
        cri.note, cri.unit_price_snapshot, cri.line_return_value, cri.sales_unit_snapshot,
        cri.packaging_snapshot, cri.created_at
      FROM customer_return_items cri
      WHERE cri.tenant_id = $1
        AND cri.customer_return_id = $2::uuid
      ORDER BY cri.created_at ASC, cri.customer_return_item_id ASC
      `,
      [tenantId, customerReturnId],
    );
    return result.rows.map((row) => ({
      customerReturnItemId: row.customer_return_item_id,
      customerReturnId: row.customer_return_id,
      saleId: row.sale_id,
      saleItemId: row.sale_item_id,
      articleId: row.article_id,
      articleCode: row.article_code_snapshot,
      commercialName: row.commercial_name_snapshot,
      lotId: row.lot_id,
      lotNumber: row.lot_number_snapshot,
      expiryDate: row.expiry_date_snapshot,
      saleQuantity: Number(row.sale_quantity),
      returnedQuantity: Number(row.returned_quantity),
      conditionStatus: row.condition_status,
      note: row.note,
      unitPriceSnapshot: Number(row.unit_price_snapshot),
      lineReturnValue: Number(row.line_return_value),
      salesUnitSnapshot: row.sales_unit_snapshot,
      packagingSnapshot: row.packaging_snapshot,
      createdAt: row.created_at,
    }));
  }

  private async findReplacementItems(queryable: Queryable, tenantId: string, customerReturnId: string) {
    const result = await queryable.query<CustomerReturnReplacementRow>(
      `
      SELECT
        crri.customer_return_replacement_item_id, crri.customer_return_id, crri.article_id,
        a.article_code, a.commercial_name, crri.sales_unit_id, crri.sales_unit_snapshot,
        crri.packaging_snapshot, crri.quantity, crri.unit_price, crri.discount_amount,
        crri.line_total, crri.created_by, crri.created_at
      FROM customer_return_replacement_items crri
      JOIN articles a ON a.article_id = crri.article_id AND a.tenant_id = crri.tenant_id
      WHERE crri.tenant_id = $1
        AND crri.customer_return_id = $2::uuid
      ORDER BY crri.created_at ASC, crri.customer_return_replacement_item_id ASC
      `,
      [tenantId, customerReturnId],
    );
    return result.rows.map((row) => ({
      customerReturnReplacementItemId: row.customer_return_replacement_item_id,
      customerReturnId: row.customer_return_id,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      salesUnitId: row.sales_unit_id,
      salesUnitSnapshot: row.sales_unit_snapshot,
      packagingSnapshot: row.packaging_snapshot,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      discountAmount: Number(row.discount_amount),
      lineTotal: Number(row.line_total),
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  private async findSettlements(queryable: Queryable, tenantId: string, customerReturnId: string) {
    const result = await queryable.query<CustomerReturnSettlementRow>(
      `
      SELECT
        customer_return_settlement_id, customer_return_id, customer_id, settlement_kind,
        payment_source, currency_code, exchange_rate_applied, amount, amount_equivalent_usd,
        cash_session_id, expiration_date, reference, note, created_by, created_at
      FROM customer_return_settlements
      WHERE tenant_id = $1
        AND customer_return_id = $2::uuid
      ORDER BY created_at ASC, customer_return_settlement_id ASC
      `,
      [tenantId, customerReturnId],
    );
    return result.rows.map((row) => ({
      customerReturnSettlementId: row.customer_return_settlement_id,
      customerReturnId: row.customer_return_id,
      customerId: row.customer_id,
      settlementKind: row.settlement_kind,
      paymentSource: row.payment_source,
      currencyCode: row.currency_code,
      exchangeRateApplied: Number(row.exchange_rate_applied),
      amount: Number(row.amount),
      amountEquivalentUsd: Number(row.amount_equivalent_usd),
      cashSessionId: row.cash_session_id,
      expirationDate: row.expiration_date,
      reference: row.reference,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  private async findCreditsByReturn(queryable: Queryable, tenantId: string, customerReturnId: string) {
    const result = await queryable.query<CustomerCreditRow>(
      `
      SELECT
        cc.customer_credit_id, cc.customer_id, c.customer_name, cc.customer_return_id,
        cc.currency_code, cc.initial_amount, cc.remaining_amount, cc.exchange_rate_applied,
        cc.status, cc.expiration_date, cc.reference, cc.note, cc.created_by, cc.created_at,
        cc.used_at, cc.cancelled_at
      FROM customer_credits cc
      JOIN customers c ON c.customer_id = cc.customer_id AND c.tenant_id = cc.tenant_id
      WHERE cc.tenant_id = $1
        AND cc.customer_return_id = $2::uuid
      ORDER BY cc.created_at ASC, cc.customer_credit_id ASC
      `,
      [tenantId, customerReturnId],
    );
    return result.rows.map((row) => this.toCustomerCredit(row));
  }

  private async findHeader(queryable: Queryable, tenantId: string, customerReturnId: string, siteId: string | null, forUpdate = false) {
    const result = await queryable.query<CustomerReturnRow>(
      `
      SELECT
        cr.customer_return_id, cr.tenant_id, cr.site_id, s.site_name, cr.sale_id,
        cr.sale_number_snapshot, cr.sale_date_snapshot, cr.sale_type_snapshot,
        cr.customer_id, cr.customer_name_snapshot, cr.organization_id, cr.organization_name_snapshot,
        cr.membership_id, cr.site_name_snapshot, cr.currency_code, cr.exchange_rate_snapshot,
        cr.return_number, cr.return_date, cr.status, cr.reason, cr.note, cr.inspection_note,
        cr.returned_value_usd, cr.replacement_value_usd, cr.financial_difference_usd,
        cr.refund_due_usd, cr.additional_payment_due_usd, cr.customer_credit_usd,
        cr.refunded_amount_usd, cr.additional_paid_usd,
        cr.created_by, cr.inspected_by, cr.validated_by, cr.created_at, cr.inspected_at,
        cr.validated_at, cr.cancelled_at
      FROM customer_returns cr
      LEFT JOIN sites s ON s.site_id = cr.site_id AND s.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = $1
        AND cr.customer_return_id = $2::uuid
        AND ($3::uuid IS NULL OR cr.site_id = $3::uuid)
      ${forUpdate ? 'FOR UPDATE' : ''}
      LIMIT 1
      `,
      [tenantId, customerReturnId, siteId],
    );
    return result.rows[0] ?? null;
  }

  private async assertArticle(tenantId: string, articleId: string) {
    const result = await this.db.query<ArticleForReplacement>(
      `
      SELECT article_id, article_code, commercial_name, packaging, sales_unit_id, selling_price
      FROM articles
      WHERE tenant_id = $1
        AND article_id = $2::uuid
      LIMIT 1
      `,
      [tenantId, articleId],
    );
    if (!result.rows[0]) throw new Error('ARTICLE_NOT_FOUND');
    return result.rows[0];
  }

  private async assertCashSession(user: AuthUser, siteId: string, cashSessionId: string) {
    const result = await this.db.query<{ cash_session_id: string }>(
      `
      SELECT cash_session_id
      FROM cash_sessions
      WHERE tenant_id = $1
        AND cash_session_id = $2::uuid
        AND site_id = $3::uuid
        AND status = 'OPEN'
        AND ($4::uuid IS NULL OR site_id = $4::uuid)
      LIMIT 1
      `,
      [user.tenantId, cashSessionId, siteId, user.siteId ?? null],
    );
    if (!result.rows[0]) throw new Error('CASH_SESSION_NOT_OPEN');
  }

  private async unitLabel(tenantId: string, productUnitId: string) {
    if (!productUnitId) return null;
    const result = await this.db.query<{ unit_label: string }>(
      `SELECT unit_label FROM product_units WHERE tenant_id = $1 AND product_unit_id = $2::uuid LIMIT 1`,
      [tenantId, productUnitId],
    );
    return result.rows[0]?.unit_label ?? null;
  }

  private async nextReturnNumber(queryable: Queryable, tenantId: string) {
    const result = await queryable.query<{ return_number: string }>(
      `
      SELECT return_number
      FROM customer_returns
      WHERE tenant_id = $1
        AND return_number ~ '^CRT-[0-9]+$'
      ORDER BY substring(return_number from '[0-9]+$')::int DESC
      LIMIT 1
      `,
      [tenantId],
    );
    const last = Number(result.rows[0]?.return_number?.split('-').pop() ?? 0);
    return `CRT-${String(last + 1).padStart(6, '0')}`;
  }

  private async syncFinancials(tenantId: string, customerReturnId: string, queryable: Queryable = this.db) {
    const result = await queryable.query<{
      returned_value_usd: string;
      replacement_value_usd: string;
      financial_difference_usd: string;
      refund_due_usd: string;
      additional_payment_due_usd: string;
      customer_credit_usd: string;
      refunded_amount_usd: string;
      additional_paid_usd: string;
    }>(
      `
      WITH header AS (
        SELECT currency_code, exchange_rate_snapshot
        FROM customer_returns
        WHERE tenant_id = $1
          AND customer_return_id = $2::uuid
      ),
      item_totals AS (
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN header.currency_code = 'CDF' THEN cri.line_return_value / NULLIF(header.exchange_rate_snapshot, 0)
                ELSE cri.line_return_value
              END
            ),
            0
          )::numeric AS returned_value_usd
        FROM customer_return_items cri
        CROSS JOIN header
        WHERE cri.tenant_id = $1
          AND cri.customer_return_id = $2::uuid
      ),
      replacement_totals AS (
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN header.currency_code = 'CDF' THEN crri.line_total / NULLIF(header.exchange_rate_snapshot, 0)
                ELSE crri.line_total
              END
            ),
            0
          )::numeric AS replacement_value_usd
        FROM customer_return_replacement_items crri
        CROSS JOIN header
        WHERE crri.tenant_id = $1
          AND crri.customer_return_id = $2::uuid
      ),
      settlement_totals AS (
        SELECT
          COALESCE(SUM(CASE WHEN settlement_kind = 'REFUND' THEN amount_equivalent_usd ELSE 0 END), 0)::numeric AS refunded_amount_usd,
          COALESCE(SUM(CASE WHEN settlement_kind = 'ADDITIONAL_PAYMENT' THEN amount_equivalent_usd ELSE 0 END), 0)::numeric AS additional_paid_usd,
          COALESCE(SUM(CASE WHEN settlement_kind = 'CUSTOMER_CREDIT' THEN amount_equivalent_usd ELSE 0 END), 0)::numeric AS customer_credit_usd
        FROM customer_return_settlements
        WHERE tenant_id = $1
          AND customer_return_id = $2::uuid
      ),
      snapshot AS (
        SELECT
          ROUND(item_totals.returned_value_usd, 2)::numeric AS returned_value_usd,
          ROUND(replacement_totals.replacement_value_usd, 2)::numeric AS replacement_value_usd,
          ROUND(item_totals.returned_value_usd - replacement_totals.replacement_value_usd, 2)::numeric AS financial_difference_usd,
          GREATEST(
            ROUND(item_totals.returned_value_usd - replacement_totals.replacement_value_usd, 2)
            - (settlement_totals.refunded_amount_usd + settlement_totals.customer_credit_usd),
            0
          )::numeric AS refund_due_usd,
          GREATEST(
            ROUND(replacement_totals.replacement_value_usd - item_totals.returned_value_usd, 2)
            - settlement_totals.additional_paid_usd,
            0
          )::numeric AS additional_payment_due_usd,
          settlement_totals.customer_credit_usd,
          settlement_totals.refunded_amount_usd,
          settlement_totals.additional_paid_usd
        FROM item_totals, replacement_totals, settlement_totals
      )
      UPDATE customer_returns cr
      SET returned_value_usd = snapshot.returned_value_usd,
          replacement_value_usd = snapshot.replacement_value_usd,
          financial_difference_usd = snapshot.financial_difference_usd,
          refund_due_usd = snapshot.refund_due_usd,
          additional_payment_due_usd = snapshot.additional_payment_due_usd,
          customer_credit_usd = snapshot.customer_credit_usd,
          refunded_amount_usd = snapshot.refunded_amount_usd,
          additional_paid_usd = snapshot.additional_paid_usd
      FROM snapshot
      WHERE cr.tenant_id = $1
        AND cr.customer_return_id = $2::uuid
      RETURNING cr.returned_value_usd, cr.replacement_value_usd, cr.financial_difference_usd,
                cr.refund_due_usd, cr.additional_payment_due_usd, cr.customer_credit_usd,
                cr.refunded_amount_usd, cr.additional_paid_usd
      `,
      [tenantId, customerReturnId],
    );
    const row = result.rows[0];
    return {
      returnedValueUsd: Number(row?.returned_value_usd ?? 0),
      replacementValueUsd: Number(row?.replacement_value_usd ?? 0),
      financialDifferenceUsd: Number(row?.financial_difference_usd ?? 0),
      refundDueUsd: Number(row?.refund_due_usd ?? 0),
      additionalPaymentDueUsd: Number(row?.additional_payment_due_usd ?? 0),
      customerCreditUsd: Number(row?.customer_credit_usd ?? 0),
      refundedAmountUsd: Number(row?.refunded_amount_usd ?? 0),
      additionalPaidUsd: Number(row?.additional_paid_usd ?? 0),
    } satisfies CustomerReturnFinancialSnapshot;
  }

  private async insertAudit(queryable: Queryable, user: AuthUser, recordId: string, actionType: string, payload: unknown) {
    await queryable.query(
      `
      INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
      VALUES ($1,$2,$3,'customer_returns',$4,$5,$6::jsonb)
      `,
      [user.tenantId, user.siteId ?? null, user.userId, recordId, actionType, JSON.stringify(payload)],
    );
  }

  private toReturn(row: CustomerReturnRow) {
    return {
      customerReturnId: row.customer_return_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      saleId: row.sale_id,
      saleNumberSnapshot: row.sale_number_snapshot,
      saleDateSnapshot: row.sale_date_snapshot,
      saleTypeSnapshot: row.sale_type_snapshot,
      customerId: row.customer_id,
      customerNameSnapshot: row.customer_name_snapshot,
      organizationId: row.organization_id,
      organizationNameSnapshot: row.organization_name_snapshot,
      membershipId: row.membership_id,
      siteNameSnapshot: row.site_name_snapshot,
      currencyCode: row.currency_code,
      exchangeRateSnapshot: Number(row.exchange_rate_snapshot),
      returnNumber: row.return_number,
      returnDate: row.return_date,
      status: row.status,
      reason: row.reason,
      note: row.note,
      inspectionNote: row.inspection_note,
      returnedValueUsd: Number(row.returned_value_usd ?? 0),
      replacementValueUsd: Number(row.replacement_value_usd ?? 0),
      financialDifferenceUsd: Number(row.financial_difference_usd ?? 0),
      refundDueUsd: Number(row.refund_due_usd ?? 0),
      additionalPaymentDueUsd: Number(row.additional_payment_due_usd ?? 0),
      customerCreditUsd: Number(row.customer_credit_usd ?? 0),
      refundedAmountUsd: Number(row.refunded_amount_usd ?? 0),
      additionalPaidUsd: Number(row.additional_paid_usd ?? 0),
      createdBy: row.created_by,
      inspectedBy: row.inspected_by,
      validatedBy: row.validated_by,
      createdAt: row.created_at,
      inspectedAt: row.inspected_at,
      validatedAt: row.validated_at,
      cancelledAt: row.cancelled_at,
      itemsCount: Number(row.items_count ?? 0),
    };
  }

  private toCustomerCredit(row: CustomerCreditRow) {
    return {
      customerCreditId: row.customer_credit_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerReturnId: row.customer_return_id,
      currencyCode: row.currency_code,
      initialAmount: Number(row.initial_amount),
      remainingAmount: Number(row.remaining_amount),
      exchangeRateApplied: Number(row.exchange_rate_applied),
      status: row.status,
      expirationDate: row.expiration_date,
      reference: row.reference,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
      usedAt: row.used_at,
      cancelledAt: row.cancelled_at,
    };
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(2));
  }

  private toUsd(amount: number, currencyCode: string, exchangeRate: number) {
    if (currencyCode === 'CDF') return this.roundMoney(amount / Math.max(exchangeRate || 1, 1));
    return this.roundMoney(amount);
  }

  private toCivilDate(value: string | Date | null | undefined) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

function dtoDateFallback(settlement: { createdAt?: string | Date | null }) {
  const value = settlement.createdAt ? new Date(settlement.createdAt) : new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
