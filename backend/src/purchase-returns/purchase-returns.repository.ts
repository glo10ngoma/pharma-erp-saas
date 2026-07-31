import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { AddPurchaseReturnItemDto } from './dto/add-purchase-return-item.dto';
import { AddPurchaseReturnReplacementItemDto } from './dto/add-purchase-return-replacement-item.dto';
import { AddPurchaseReturnSettlementDto } from './dto/add-purchase-return-settlement.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';

type PurchaseReturnRow = {
  purchase_return_id: string;
  tenant_id: string;
  site_id: string;
  site_name: string | null;
  purchase_id: string;
  purchase_number: string | null;
  supplier_id: string;
  supplier_name: string | null;
  return_number: string;
  return_date: string;
  return_type: string;
  status: string;
  currency_code: string;
  exchange_rate_applied: string;
  returned_value_usd: string;
  replacement_value_usd: string;
  financial_difference_usd: string;
  refund_due_usd: string;
  additional_payment_due_usd: string;
  supplier_credit_usd: string;
  refunded_amount_usd: string;
  additional_paid_usd: string;
  reason: string | null;
  note: string | null;
  created_by: string | null;
  validated_by: string | null;
  created_at: Date;
  validated_at: Date | null;
  cancelled_at: Date | null;
};

type ReturnItemRow = {
  purchase_return_item_id: string;
  purchase_return_id: string;
  purchase_item_id: string;
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  lot_id: string;
  lot_number: string | null;
  expiry_date: string | null;
  purchase_unit_id: string | null;
  purchase_unit_label_snapshot: string | null;
  returned_purchase_quantity: string;
  conversion_factor: string;
  returned_stock_quantity: string;
  stock_unit_id: string | null;
  stock_unit_label_snapshot: string | null;
  original_unit_price: string;
  return_unit_value: string;
  line_return_value: string;
  reason: string | null;
  condition_status: string;
  created_at: Date;
};

type ReplacementItemRow = {
  purchase_return_replacement_item_id: string;
  purchase_return_id: string;
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  purchase_unit_id: string | null;
  purchase_unit_label_snapshot: string | null;
  received_purchase_quantity: string;
  conversion_factor: string;
  received_stock_quantity: string;
  stock_unit_id: string | null;
  stock_unit_label_snapshot: string | null;
  lot_number: string;
  expiry_date: string;
  unit_value: string;
  line_value: string;
  created_at: Date;
};

type SettlementRow = {
  purchase_return_settlement_id: string;
  purchase_return_id: string;
  supplier_id: string;
  settlement_kind: string;
  payment_source: string;
  currency_code: string;
  exchange_rate_applied: string;
  amount: string;
  amount_equivalent_usd: string;
  cash_session_id: string | null;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: Date;
};

@Injectable()
export class PurchaseReturnsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser, purchaseId?: string) {
    const params: unknown[] = [user.tenantId, user.siteId ?? null];
    const filters = ['pr.tenant_id = $1', '($2::uuid IS NULL OR pr.site_id = $2::uuid)'];
    if (purchaseId) {
      params.push(purchaseId);
      filters.push(`pr.purchase_id = $${params.length}::uuid`);
    }
    const result = await this.db.query<PurchaseReturnRow>(
      `
      SELECT pr.purchase_return_id, pr.tenant_id, pr.site_id, s.site_name, pr.purchase_id,
             p.purchase_number, pr.supplier_id, sup.supplier_name, pr.return_number, pr.return_date,
             pr.return_type, pr.status, pr.currency_code, pr.exchange_rate_applied, pr.returned_value_usd,
             pr.replacement_value_usd, pr.financial_difference_usd, pr.refund_due_usd,
             pr.additional_payment_due_usd, pr.supplier_credit_usd, pr.refunded_amount_usd,
             pr.additional_paid_usd, pr.reason, pr.note, pr.created_by, pr.validated_by,
             pr.created_at, pr.validated_at, pr.cancelled_at
      FROM purchase_returns pr
      JOIN purchases p ON p.purchase_id = pr.purchase_id AND p.tenant_id = pr.tenant_id
      JOIN suppliers sup ON sup.supplier_id = pr.supplier_id AND sup.tenant_id = pr.tenant_id
      JOIN sites s ON s.site_id = pr.site_id AND s.tenant_id = pr.tenant_id
      WHERE ${filters.join(' AND ')}
      ORDER BY pr.created_at DESC, pr.purchase_return_id DESC
      `,
      params,
    );
    return result.rows.map((row) => this.toPurchaseReturn(row));
  }

  async findOne(user: AuthUser, purchaseReturnId: string) {
    const result = await this.db.query<PurchaseReturnRow>(
      `
      SELECT pr.purchase_return_id, pr.tenant_id, pr.site_id, s.site_name, pr.purchase_id,
             p.purchase_number, pr.supplier_id, sup.supplier_name, pr.return_number, pr.return_date,
             pr.return_type, pr.status, pr.currency_code, pr.exchange_rate_applied, pr.returned_value_usd,
             pr.replacement_value_usd, pr.financial_difference_usd, pr.refund_due_usd,
             pr.additional_payment_due_usd, pr.supplier_credit_usd, pr.refunded_amount_usd,
             pr.additional_paid_usd, pr.reason, pr.note, pr.created_by, pr.validated_by,
             pr.created_at, pr.validated_at, pr.cancelled_at
      FROM purchase_returns pr
      JOIN purchases p ON p.purchase_id = pr.purchase_id AND p.tenant_id = pr.tenant_id
      JOIN suppliers sup ON sup.supplier_id = pr.supplier_id AND sup.tenant_id = pr.tenant_id
      JOIN sites s ON s.site_id = pr.site_id AND s.tenant_id = pr.tenant_id
      WHERE pr.tenant_id = $1
        AND pr.purchase_return_id = $2::uuid
        AND ($3::uuid IS NULL OR pr.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, purchaseReturnId, user.siteId ?? null],
    );
    if (!result.rows[0]) return null;
    const header = this.toPurchaseReturn(result.rows[0]);
    return {
      ...header,
      items: await this.findItems(user, purchaseReturnId),
      replacementItems: await this.findReplacementItems(user, purchaseReturnId),
      settlements: await this.findSettlements(user, purchaseReturnId),
    };
  }

  async create(user: AuthUser, dto: CreatePurchaseReturnDto) {
    const purchase = await this.assertPurchaseValidated(user, dto.purchaseId);
    const number = dto.returnNumber?.trim() || `RET-${Date.now()}`;
    const exchangeRate = Number(dto.exchangeRateApplied ?? purchase.exchange_rate ?? 1);
    const result = await this.db.query<{ purchase_return_id: string }>(
      `
      INSERT INTO purchase_returns (
        tenant_id, site_id, purchase_id, supplier_id, return_number, return_date,
        return_type, status, currency_code, exchange_rate_applied, reason, note, created_by
      )
      VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,'DRAFT',$8,$9,$10,$11,$12)
      RETURNING purchase_return_id
      `,
      [
        user.tenantId,
        purchase.site_id,
        dto.purchaseId,
        purchase.supplier_id,
        number,
        dto.returnDate ?? null,
        dto.returnType ?? 'REFUND',
        (dto.currencyCode ?? purchase.currency_code ?? 'USD').toUpperCase(),
        exchangeRate,
        dto.reason?.trim() || null,
        dto.note?.trim() || null,
        user.userId,
      ],
    );
    await this.insertAudit(user, result.rows[0].purchase_return_id, 'INSERT', {
      purchaseId: dto.purchaseId,
      returnNumber: number,
      returnType: dto.returnType ?? 'REFUND',
    });
    return this.findOne(user, result.rows[0].purchase_return_id);
  }

  async addItem(user: AuthUser, purchaseReturnId: string, dto: AddPurchaseReturnItemDto) {
    const current = await this.assertDraftReturn(user, purchaseReturnId);
    const purchaseItem = await this.assertPurchaseItem(current.purchase_id, dto.purchaseItemId, dto.articleId);
    await this.assertLot(user, dto.lotId, dto.articleId);
    const stockRow = await this.findStockForLot(user, current.site_id, dto.lotId);
    const returnedPurchaseQuantity = Number(dto.returnedPurchaseQuantity);
    const conversionFactor = Number(purchaseItem.conversion_factor ?? 1);
    const returnedStockQuantity = this.roundQuantity(returnedPurchaseQuantity * conversionFactor);
    if (returnedPurchaseQuantity <= 0 || returnedStockQuantity <= 0) throw new Error('INVALID_RETURN_QUANTITY');
    const alreadyReturnedStock = await this.validatedReturnedStock(dto.purchaseItemId);
    const originalStockQuantity = Number(purchaseItem.stock_quantity ?? purchaseItem.quantity);
    const maxReturnable = Math.min(originalStockQuantity - alreadyReturnedStock, Number(stockRow.quantity_available ?? 0));
    if (maxReturnable <= 0) throw new Error('RETURN_NOT_AVAILABLE');
    if (returnedStockQuantity > maxReturnable + 0.0001) throw new Error('RETURN_QUANTITY_EXCEEDS_AVAILABLE');
    const returnUnitValue = Number(dto.returnUnitValue ?? purchaseItem.purchase_unit_price);
    const lineReturnValue = this.roundMoney(returnedPurchaseQuantity * returnUnitValue);
    await this.db.query(
      `
      INSERT INTO purchase_return_items (
        tenant_id, purchase_return_id, purchase_item_id, article_id, lot_id, purchase_unit_id,
        purchase_unit_label_snapshot, returned_purchase_quantity, conversion_factor, returned_stock_quantity,
        stock_unit_id, stock_unit_label_snapshot, original_unit_price, return_unit_value, line_return_value,
        reason, condition_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `,
      [
        user.tenantId,
        purchaseReturnId,
        dto.purchaseItemId,
        dto.articleId,
        dto.lotId,
        purchaseItem.purchase_unit_id ?? null,
        purchaseItem.purchase_unit_label_snapshot ?? null,
        returnedPurchaseQuantity,
        conversionFactor,
        returnedStockQuantity,
        purchaseItem.stock_unit_id ?? null,
        purchaseItem.stock_unit_label_snapshot ?? null,
        Number(purchaseItem.purchase_unit_price),
        returnUnitValue,
        lineReturnValue,
        dto.reason?.trim() || null,
        dto.conditionStatus ?? 'GOOD',
      ],
    );
    await this.syncFinancials(user.tenantId, purchaseReturnId);
    return this.findOne(user, purchaseReturnId);
  }

  async removeItem(user: AuthUser, purchaseReturnId: string, purchaseReturnItemId: string) {
    await this.assertDraftReturn(user, purchaseReturnId);
    await this.db.query(
      `DELETE FROM purchase_return_items WHERE tenant_id = $1 AND purchase_return_id = $2::uuid AND purchase_return_item_id = $3::uuid`,
      [user.tenantId, purchaseReturnId, purchaseReturnItemId],
    );
    await this.syncFinancials(user.tenantId, purchaseReturnId);
    return this.findOne(user, purchaseReturnId);
  }

  async addReplacementItem(user: AuthUser, purchaseReturnId: string, dto: AddPurchaseReturnReplacementItemDto) {
    const current = await this.assertDraftReturn(user, purchaseReturnId);
    await this.assertArticle(user, dto.articleId);
    if (!dto.lotNumber.trim()) throw new Error('INVALID_LOT_NUMBER');
    if (new Date(`${dto.expiryDate}T00:00:00`) <= this.startOfToday()) throw new Error('INVALID_EXPIRY_DATE');
    const unitSnapshots = await this.resolveUnitSnapshots(user, dto.articleId, dto.purchaseUnitId, dto.stockUnitId);
    const conversionFactor = Number(dto.conversionFactor ?? 1);
    if (conversionFactor <= 0 || dto.receivedPurchaseQuantity <= 0) throw new Error('INVALID_REPLACEMENT_QUANTITY');
    const receivedStockQuantity = this.roundQuantity(dto.receivedPurchaseQuantity * conversionFactor);
    const lineValue = this.roundMoney(dto.receivedPurchaseQuantity * dto.unitValue);
    await this.db.query(
      `
      INSERT INTO purchase_return_replacement_items (
        tenant_id, purchase_return_id, article_id, purchase_unit_id, purchase_unit_label_snapshot,
        received_purchase_quantity, conversion_factor, received_stock_quantity, stock_unit_id,
        stock_unit_label_snapshot, lot_number, expiry_date, unit_value, line_value
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `,
      [
        user.tenantId,
        purchaseReturnId,
        dto.articleId,
        dto.purchaseUnitId ?? null,
        unitSnapshots.purchaseUnitLabel,
        dto.receivedPurchaseQuantity,
        conversionFactor,
        receivedStockQuantity,
        dto.stockUnitId ?? unitSnapshots.stockUnitId,
        unitSnapshots.stockUnitLabel,
        dto.lotNumber.trim(),
        dto.expiryDate,
        dto.unitValue,
        lineValue,
      ],
    );
    await this.syncFinancials(user.tenantId, purchaseReturnId);
    return this.findOne(user, purchaseReturnId);
  }

  async removeReplacementItem(user: AuthUser, purchaseReturnId: string, replacementItemId: string) {
    await this.assertDraftReturn(user, purchaseReturnId);
    await this.db.query(
      `DELETE FROM purchase_return_replacement_items WHERE tenant_id = $1 AND purchase_return_id = $2::uuid AND purchase_return_replacement_item_id = $3::uuid`,
      [user.tenantId, purchaseReturnId, replacementItemId],
    );
    await this.syncFinancials(user.tenantId, purchaseReturnId);
    return this.findOne(user, purchaseReturnId);
  }

  async addSettlement(user: AuthUser, purchaseReturnId: string, dto: AddPurchaseReturnSettlementDto) {
    const current = await this.assertDraftReturn(user, purchaseReturnId);
    const amount = Number(dto.amount);
    if (amount <= 0) throw new Error('INVALID_SETTLEMENT_AMOUNT');
    const currencyCode = (dto.currencyCode ?? current.currency_code ?? 'USD').toUpperCase();
    const exchangeRate = Number(dto.exchangeRateApplied ?? current.exchange_rate_applied ?? 1);
    if (currencyCode === 'CDF' && exchangeRate <= 1) throw new Error('EXCHANGE_RATE_REQUIRED');
    if (dto.paymentSource === 'CASH_REGISTER') {
      if (!dto.cashSessionId) throw new Error('CASH_SESSION_REQUIRED');
      await this.assertCashSession(user, current.site_id, dto.cashSessionId);
    }
    if (dto.settlementKind === 'SUPPLIER_CREDIT' && dto.paymentSource !== 'SUPPLIER_CREDIT') throw new Error('SUPPLIER_CREDIT_SOURCE_REQUIRED');
    const equivalentUsd = this.toUsd(amount, currencyCode, exchangeRate);
    await this.db.query(
      `
      INSERT INTO purchase_return_settlements (
        tenant_id, site_id, purchase_return_id, supplier_id, settlement_kind, payment_source,
        currency_code, exchange_rate_applied, amount, amount_equivalent_usd, cash_session_id,
        reference, note, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `,
      [
        user.tenantId,
        current.site_id,
        purchaseReturnId,
        current.supplier_id,
        dto.settlementKind,
        dto.paymentSource,
        currencyCode,
        exchangeRate,
        amount,
        equivalentUsd,
        dto.cashSessionId ?? null,
        dto.reference?.trim() || null,
        dto.note?.trim() || null,
        user.userId,
      ],
    );
    await this.syncFinancials(user.tenantId, purchaseReturnId);
    return this.findOne(user, purchaseReturnId);
  }

  async removeSettlement(user: AuthUser, purchaseReturnId: string, settlementId: string) {
    await this.assertDraftReturn(user, purchaseReturnId);
    await this.db.query(
      `DELETE FROM purchase_return_settlements WHERE tenant_id = $1 AND purchase_return_id = $2::uuid AND purchase_return_settlement_id = $3::uuid`,
      [user.tenantId, purchaseReturnId, settlementId],
    );
    await this.syncFinancials(user.tenantId, purchaseReturnId);
    return this.findOne(user, purchaseReturnId);
  }

  async cancel(user: AuthUser, purchaseReturnId: string) {
    const current = await this.assertDraftReturn(user, purchaseReturnId);
    await this.db.query(
      `UPDATE purchase_returns SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND purchase_return_id = $2::uuid`,
      [user.tenantId, purchaseReturnId],
    );
    await this.insertAudit(user, purchaseReturnId, 'CANCEL', { previousStatus: current.status, nextStatus: 'CANCELLED' });
    return this.findOne(user, purchaseReturnId);
  }

  async validate(user: AuthUser, purchaseReturnId: string) {
    await this.db.transaction(async (client) => {
      const headerResult = await client.query<PurchaseReturnRow & { site_id: string; purchase_id: string; supplier_id: string }>(
        `
        SELECT pr.purchase_return_id, pr.tenant_id, pr.site_id, NULL::text AS site_name, pr.purchase_id,
               NULL::text AS purchase_number, pr.supplier_id, NULL::text AS supplier_name, pr.return_number,
               pr.return_date, pr.return_type, pr.status, pr.currency_code, pr.exchange_rate_applied,
               pr.returned_value_usd, pr.replacement_value_usd, pr.financial_difference_usd,
               pr.refund_due_usd, pr.additional_payment_due_usd, pr.supplier_credit_usd,
               pr.refunded_amount_usd, pr.additional_paid_usd, pr.reason, pr.note,
               pr.created_by, pr.validated_by, pr.created_at, pr.validated_at, pr.cancelled_at
        FROM purchase_returns pr
        WHERE pr.tenant_id = $1
          AND pr.purchase_return_id = $2::uuid
          AND ($3::uuid IS NULL OR pr.site_id = $3::uuid)
        FOR UPDATE
        `,
        [user.tenantId, purchaseReturnId, user.siteId ?? null],
      );
      const header = headerResult.rows[0];
      if (!header) throw new Error('PURCHASE_RETURN_NOT_FOUND');
      if (header.status !== 'DRAFT') throw new Error('PURCHASE_RETURN_NOT_DRAFT');

      const purchase = await client.query<{ purchase_id: string; purchase_number: string; status: string; site_id: string; supplier_id: string; currency_id: string | null }>(
        `
        SELECT purchase_id, purchase_number, status, site_id, supplier_id, currency_id
        FROM purchases
        WHERE tenant_id = $1
          AND purchase_id = $2::uuid
        FOR UPDATE
        `,
        [user.tenantId, header.purchase_id],
      );
      if (!purchase.rows[0]) throw new Error('PURCHASE_NOT_FOUND');
      if (purchase.rows[0].status !== 'VALIDATED') throw new Error('PURCHASE_RETURN_PURCHASE_NOT_VALIDATED');

      const items = await client.query<ReturnItemRow>(
        `
        SELECT pri.purchase_return_item_id, pri.purchase_return_id, pri.purchase_item_id, pri.article_id,
               a.article_code, a.commercial_name, pri.lot_id, l.lot_number, l.expiry_date,
               pri.purchase_unit_id, pri.purchase_unit_label_snapshot, pri.returned_purchase_quantity,
               pri.conversion_factor, pri.returned_stock_quantity, pri.stock_unit_id,
               pri.stock_unit_label_snapshot, pri.original_unit_price, pri.return_unit_value,
               pri.line_return_value, pri.reason, pri.condition_status, pri.created_at
        FROM purchase_return_items pri
        JOIN articles a ON a.article_id = pri.article_id AND a.tenant_id = pri.tenant_id
        JOIN lots l ON l.lot_id = pri.lot_id AND l.article_id = pri.article_id
        WHERE pri.tenant_id = $1
          AND pri.purchase_return_id = $2::uuid
        `,
        [user.tenantId, purchaseReturnId],
      );
      if (!items.rows.length) throw new Error('PURCHASE_RETURN_HAS_NO_ITEMS');

      const replacements = await client.query<ReplacementItemRow>(
        `
        SELECT prri.purchase_return_replacement_item_id, prri.purchase_return_id, prri.article_id,
               a.article_code, a.commercial_name, prri.purchase_unit_id, prri.purchase_unit_label_snapshot,
               prri.received_purchase_quantity, prri.conversion_factor, prri.received_stock_quantity,
               prri.stock_unit_id, prri.stock_unit_label_snapshot, prri.lot_number, prri.expiry_date,
               prri.unit_value, prri.line_value, prri.created_at
        FROM purchase_return_replacement_items prri
        JOIN articles a ON a.article_id = prri.article_id AND a.tenant_id = prri.tenant_id
        WHERE prri.tenant_id = $1
          AND prri.purchase_return_id = $2::uuid
        `,
        [user.tenantId, purchaseReturnId],
      );

      const settlements = await client.query<SettlementRow>(
        `
        SELECT purchase_return_settlement_id, purchase_return_id, supplier_id, settlement_kind, payment_source,
               currency_code, exchange_rate_applied, amount, amount_equivalent_usd, cash_session_id,
               reference, note, created_by, created_at
        FROM purchase_return_settlements
        WHERE tenant_id = $1
          AND purchase_return_id = $2::uuid
        ORDER BY created_at ASC, purchase_return_settlement_id ASC
        `,
        [user.tenantId, purchaseReturnId],
      );

      for (const item of items.rows) {
        const stock = await client.query<{ quantity_available: string }>(
          `
          SELECT quantity_available
          FROM stocks
          WHERE site_id = $1
            AND lot_id = $2::uuid
          FOR UPDATE
          `,
          [header.site_id, item.lot_id],
        );
        if (!stock.rows[0]) throw new Error('RETURN_STOCK_NOT_FOUND');
        if (Number(stock.rows[0].quantity_available) < Number(item.returned_stock_quantity)) throw new Error('RETURN_QUANTITY_EXCEEDS_AVAILABLE');
        await client.query(
          `
          UPDATE stocks
          SET quantity_available = quantity_available - $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE site_id = $1
            AND lot_id = $2::uuid
          `,
          [header.site_id, item.lot_id, Number(item.returned_stock_quantity)],
        );
        await client.query(
          `
          INSERT INTO stock_movements (
            tenant_id, site_id, article_id, lot_id, movement_type, quantity,
            reference_type, reference_id, notes, user_id
          )
          VALUES ($1,$2,$3,$4,'PURCHASE_RETURN_OUT',$5,'PURCHASE_RETURN',$6,$7,$8)
          `,
          [
            user.tenantId,
            header.site_id,
            item.article_id,
            item.lot_id,
            Number(item.returned_stock_quantity),
            purchaseReturnId,
            `Retour fournisseur ${header.return_number}`,
            user.userId,
          ],
        );
      }

      for (const replacement of replacements.rows) {
        if (new Date(`${replacement.expiry_date}T00:00:00`) <= this.startOfToday()) throw new Error('INVALID_EXPIRY_DATE');
        const lotResult = await client.query<{ lot_id: string }>(
          `
          INSERT INTO lots (
            tenant_id, article_id, supplier_id, lot_number, expiry_date,
            purchase_price, selling_price, currency_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$6,$7)
          ON CONFLICT (article_id, lot_number) DO UPDATE
          SET expiry_date = EXCLUDED.expiry_date,
              purchase_price = EXCLUDED.purchase_price,
              selling_price = EXCLUDED.selling_price,
              currency_id = EXCLUDED.currency_id
          RETURNING lot_id
          `,
          [
            user.tenantId,
            replacement.article_id,
            header.supplier_id,
            replacement.lot_number.trim(),
            replacement.expiry_date,
            Number(replacement.unit_value),
            purchase.rows[0].currency_id,
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
          [user.tenantId, header.site_id, lotId, Number(replacement.received_stock_quantity)],
        );
        await client.query(
          `
          INSERT INTO stock_movements (
            tenant_id, site_id, article_id, lot_id, movement_type, quantity,
            reference_type, reference_id, notes, user_id
          )
          VALUES ($1,$2,$3,$4,'PURCHASE_EXCHANGE_IN',$5,'PURCHASE_RETURN',$6,$7,$8)
          `,
          [
            user.tenantId,
            header.site_id,
            replacement.article_id,
            lotId,
            Number(replacement.received_stock_quantity),
            purchaseReturnId,
            `Echange fournisseur ${header.return_number}`,
            user.userId,
          ],
        );
      }

      const snapshot = await this.syncFinancials(user.tenantId, purchaseReturnId, client);
      if (snapshot.financialDifferenceUsd > 0.0001 && snapshot.refundedAmountUsd + snapshot.supplierCreditUsd > snapshot.financialDifferenceUsd + 0.01) {
        throw new Error('RETURN_SETTLEMENT_EXCEEDS_REFUND');
      }
      if (snapshot.financialDifferenceUsd < -0.0001 && snapshot.additionalPaidUsd > Math.abs(snapshot.financialDifferenceUsd) + 0.01) {
        throw new Error('RETURN_SETTLEMENT_EXCEEDS_ADDITIONAL');
      }

      for (const settlement of settlements.rows) {
        if (settlement.payment_source !== 'CASH_REGISTER' || !settlement.cash_session_id) continue;
        if (settlement.settlement_kind === 'REFUND') {
          await client.query(
            `
            INSERT INTO cash_movements (
              tenant_id, cash_session_id, movement_type, amount, currency_id,
              reference_type, reference_id, description, created_by
            )
            VALUES ($1,$2,'PURCHASE_REFUND',$3,(SELECT currency_id FROM currencies WHERE currency_code = $4 LIMIT 1),'PURCHASE_RETURN',$5,$6,$7)
            `,
            [user.tenantId, settlement.cash_session_id, Number(settlement.amount), settlement.currency_code, purchaseReturnId, `Remboursement fournisseur ${header.return_number}`, user.userId],
          );
        }
        if (settlement.settlement_kind === 'ADDITIONAL_PAYMENT') {
          await client.query(
            `
            INSERT INTO cash_movements (
              tenant_id, cash_session_id, movement_type, amount, currency_id,
              reference_type, reference_id, description, created_by
            )
            VALUES ($1,$2,'PURCHASE_EXCHANGE_PAYMENT',$3,(SELECT currency_id FROM currencies WHERE currency_code = $4 LIMIT 1),'PURCHASE_RETURN',$5,$6,$7)
            `,
            [user.tenantId, settlement.cash_session_id, Number(settlement.amount), settlement.currency_code, purchaseReturnId, `Complement fournisseur ${header.return_number}`, user.userId],
          );
        }
      }

      for (const settlement of settlements.rows.filter((entry) => entry.settlement_kind === 'SUPPLIER_CREDIT')) {
        await client.query(
          `
          INSERT INTO supplier_credits (
            tenant_id, site_id, supplier_id, purchase_return_id, currency_code,
            original_amount, remaining_amount, exchange_rate_applied, status,
            reference, note, created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11)
          `,
          [
            user.tenantId,
            header.site_id,
            header.supplier_id,
            purchaseReturnId,
            settlement.currency_code,
            Number(settlement.amount),
            Number(settlement.exchange_rate_applied),
            Number(settlement.amount) > 0 ? 'AVAILABLE' : 'USED',
            settlement.reference ?? null,
            settlement.note ?? null,
            settlement.created_by ?? user.userId,
          ],
        );
      }

      const finalStatus = snapshot.financialDifferenceUsd > 0.0001
        ? (snapshot.refundDueUsd <= 0.01 ? 'SETTLED' : snapshot.refundedAmountUsd + snapshot.supplierCreditUsd > 0 ? 'PARTIALLY_SETTLED' : 'VALIDATED')
        : snapshot.financialDifferenceUsd < -0.0001
          ? (snapshot.additionalPaymentDueUsd <= 0.01 ? 'SETTLED' : snapshot.additionalPaidUsd > 0 ? 'PARTIALLY_SETTLED' : 'VALIDATED')
          : 'SETTLED';

      await client.query(
        `
        UPDATE purchase_returns
        SET status = $3,
            validated_by = $4,
            validated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND purchase_return_id = $2::uuid
        `,
        [user.tenantId, purchaseReturnId, finalStatus, user.userId],
      );
      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1,$2,$3,'purchase_returns',$4,'VALIDATE',$5::jsonb)
        `,
        [user.tenantId, header.site_id, user.userId, purchaseReturnId, JSON.stringify({ status: finalStatus, returnNumber: header.return_number })],
      );
    });
    return this.findOne(user, purchaseReturnId);
  }

  async findSupplierCredits(user: AuthUser) {
    const result = await this.db.query(
      `
      SELECT sc.supplier_credit_id, sc.supplier_id, sup.supplier_name, sc.purchase_return_id,
             sc.currency_code, sc.original_amount, sc.remaining_amount, sc.exchange_rate_applied,
             sc.status, sc.reference, sc.note, sc.created_at, sc.used_at
      FROM supplier_credits sc
      JOIN suppliers sup ON sup.supplier_id = sc.supplier_id AND sup.tenant_id = sc.tenant_id
      WHERE sc.tenant_id = $1
        AND ($2::uuid IS NULL OR sc.site_id = $2::uuid)
      ORDER BY sc.created_at DESC, sc.supplier_credit_id DESC
      `,
      [user.tenantId, user.siteId ?? null],
    );
    return result.rows.map((row: any) => ({
      supplierCreditId: row.supplier_credit_id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      purchaseReturnId: row.purchase_return_id,
      currencyCode: row.currency_code,
      originalAmount: Number(row.original_amount),
      remainingAmount: Number(row.remaining_amount),
      exchangeRateApplied: Number(row.exchange_rate_applied),
      status: row.status,
      reference: row.reference,
      note: row.note,
      createdAt: row.created_at,
      usedAt: row.used_at,
    }));
  }

  private async findItems(user: AuthUser, purchaseReturnId: string) {
    const result = await this.db.query<ReturnItemRow>(
      `
      SELECT pri.purchase_return_item_id, pri.purchase_return_id, pri.purchase_item_id, pri.article_id,
             a.article_code, a.commercial_name, pri.lot_id, l.lot_number, l.expiry_date,
             pri.purchase_unit_id, pri.purchase_unit_label_snapshot, pri.returned_purchase_quantity,
             pri.conversion_factor, pri.returned_stock_quantity, pri.stock_unit_id,
             pri.stock_unit_label_snapshot, pri.original_unit_price, pri.return_unit_value,
             pri.line_return_value, pri.reason, pri.condition_status, pri.created_at
      FROM purchase_return_items pri
      JOIN articles a ON a.article_id = pri.article_id AND a.tenant_id = pri.tenant_id
      JOIN lots l ON l.lot_id = pri.lot_id
      WHERE pri.tenant_id = $1
        AND pri.purchase_return_id = $2::uuid
      ORDER BY pri.created_at ASC, pri.purchase_return_item_id ASC
      `,
      [user.tenantId, purchaseReturnId],
    );
    return result.rows.map((row) => ({
      purchaseReturnItemId: row.purchase_return_item_id,
      purchaseReturnId: row.purchase_return_id,
      purchaseItemId: row.purchase_item_id,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      lotId: row.lot_id,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date,
      purchaseUnitId: row.purchase_unit_id,
      purchaseUnitLabelSnapshot: row.purchase_unit_label_snapshot,
      returnedPurchaseQuantity: Number(row.returned_purchase_quantity),
      conversionFactor: Number(row.conversion_factor),
      returnedStockQuantity: Number(row.returned_stock_quantity),
      stockUnitId: row.stock_unit_id,
      stockUnitLabelSnapshot: row.stock_unit_label_snapshot,
      originalUnitPrice: Number(row.original_unit_price),
      returnUnitValue: Number(row.return_unit_value),
      lineReturnValue: Number(row.line_return_value),
      reason: row.reason,
      conditionStatus: row.condition_status,
      createdAt: row.created_at,
    }));
  }

  private async findReplacementItems(user: AuthUser, purchaseReturnId: string) {
    const result = await this.db.query<ReplacementItemRow>(
      `
      SELECT prri.purchase_return_replacement_item_id, prri.purchase_return_id, prri.article_id,
             a.article_code, a.commercial_name, prri.purchase_unit_id, prri.purchase_unit_label_snapshot,
             prri.received_purchase_quantity, prri.conversion_factor, prri.received_stock_quantity,
             prri.stock_unit_id, prri.stock_unit_label_snapshot, prri.lot_number, prri.expiry_date,
             prri.unit_value, prri.line_value, prri.created_at
      FROM purchase_return_replacement_items prri
      JOIN articles a ON a.article_id = prri.article_id AND a.tenant_id = prri.tenant_id
      WHERE prri.tenant_id = $1
        AND prri.purchase_return_id = $2::uuid
      ORDER BY prri.created_at ASC, prri.purchase_return_replacement_item_id ASC
      `,
      [user.tenantId, purchaseReturnId],
    );
    return result.rows.map((row) => ({
      purchaseReturnReplacementItemId: row.purchase_return_replacement_item_id,
      purchaseReturnId: row.purchase_return_id,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      purchaseUnitId: row.purchase_unit_id,
      purchaseUnitLabelSnapshot: row.purchase_unit_label_snapshot,
      receivedPurchaseQuantity: Number(row.received_purchase_quantity),
      conversionFactor: Number(row.conversion_factor),
      receivedStockQuantity: Number(row.received_stock_quantity),
      stockUnitId: row.stock_unit_id,
      stockUnitLabelSnapshot: row.stock_unit_label_snapshot,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date,
      unitValue: Number(row.unit_value),
      lineValue: Number(row.line_value),
      createdAt: row.created_at,
    }));
  }

  private async findSettlements(user: AuthUser, purchaseReturnId: string) {
    const result = await this.db.query<SettlementRow>(
      `
      SELECT purchase_return_settlement_id, purchase_return_id, supplier_id, settlement_kind, payment_source,
             currency_code, exchange_rate_applied, amount, amount_equivalent_usd, cash_session_id,
             reference, note, created_by, created_at
      FROM purchase_return_settlements
      WHERE tenant_id = $1
        AND purchase_return_id = $2::uuid
      ORDER BY created_at ASC, purchase_return_settlement_id ASC
      `,
      [user.tenantId, purchaseReturnId],
    );
    return result.rows.map((row) => ({
      purchaseReturnSettlementId: row.purchase_return_settlement_id,
      purchaseReturnId: row.purchase_return_id,
      supplierId: row.supplier_id,
      settlementKind: row.settlement_kind,
      paymentSource: row.payment_source,
      currencyCode: row.currency_code,
      exchangeRateApplied: Number(row.exchange_rate_applied),
      amount: Number(row.amount),
      amountEquivalentUsd: Number(row.amount_equivalent_usd),
      cashSessionId: row.cash_session_id,
      reference: row.reference,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  private async assertDraftReturn(user: AuthUser, purchaseReturnId: string) {
    const result = await this.db.query<any>(
      `
      SELECT purchase_return_id, purchase_id, supplier_id, site_id, status, currency_code, exchange_rate_applied
      FROM purchase_returns
      WHERE tenant_id = $1
        AND purchase_return_id = $2::uuid
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, purchaseReturnId, user.siteId ?? null],
    );
    if (!result.rows[0]) throw new Error('PURCHASE_RETURN_NOT_FOUND');
    if (result.rows[0].status !== 'DRAFT') throw new Error('PURCHASE_RETURN_NOT_DRAFT');
    return result.rows[0];
  }

  private async assertPurchaseValidated(user: AuthUser, purchaseId: string) {
    const result = await this.db.query<any>(
      `
      SELECT p.purchase_id, p.status, p.site_id, p.supplier_id, p.exchange_rate, cur.currency_code
      FROM purchases p
      LEFT JOIN currencies cur ON cur.currency_id = p.currency_id
      WHERE p.tenant_id = $1
        AND p.purchase_id = $2::uuid
        AND ($3::uuid IS NULL OR p.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, purchaseId, user.siteId ?? null],
    );
    if (!result.rows[0]) throw new Error('PURCHASE_NOT_FOUND');
    if (result.rows[0].status !== 'VALIDATED') throw new Error('PURCHASE_RETURN_PURCHASE_NOT_VALIDATED');
    return result.rows[0];
  }

  private async assertPurchaseItem(purchaseId: string, purchaseItemId: string, articleId: string) {
    const result = await this.db.query<any>(
      `
      SELECT purchase_item_id, purchase_id, article_id, quantity, purchase_unit_id,
             purchase_unit_label_snapshot, purchase_quantity, conversion_factor,
             stock_unit_id, stock_unit_label_snapshot, stock_quantity, purchase_unit_price
      FROM purchase_items
      WHERE purchase_id = $1::uuid
        AND purchase_item_id = $2::uuid
        AND article_id = $3::uuid
      LIMIT 1
      `,
      [purchaseId, purchaseItemId, articleId],
    );
    if (!result.rows[0]) throw new Error('PURCHASE_RETURN_ITEM_NOT_FOUND');
    return result.rows[0];
  }

  private async assertLot(user: AuthUser, lotId: string, articleId: string) {
    const result = await this.db.query<any>(
      `
      SELECT lot_id, article_id, lot_number, expiry_date
      FROM lots
      WHERE tenant_id = $1
        AND lot_id = $2::uuid
        AND article_id = $3::uuid
      LIMIT 1
      `,
      [user.tenantId, lotId, articleId],
    );
    if (!result.rows[0]) throw new Error('PURCHASE_RETURN_LOT_NOT_FOUND');
    return result.rows[0];
  }

  private async findStockForLot(user: AuthUser, siteId: string, lotId: string) {
    const result = await this.db.query<any>(
      `
      SELECT quantity_available
      FROM stocks
      WHERE site_id = $1::uuid
        AND lot_id = $2::uuid
      LIMIT 1
      `,
      [siteId, lotId],
    );
    if (!result.rows[0]) throw new Error('RETURN_STOCK_NOT_FOUND');
    return result.rows[0];
  }

  private async validatedReturnedStock(purchaseItemId: string) {
    const result = await this.db.query<{ total: string }>(
      `
      SELECT COALESCE(SUM(pri.returned_stock_quantity), 0)::numeric AS total
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pr.purchase_return_id = pri.purchase_return_id
      WHERE pri.purchase_item_id = $1::uuid
        AND pr.status IN ('VALIDATED', 'PARTIALLY_SETTLED', 'SETTLED')
      `,
      [purchaseItemId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  private async assertArticle(user: AuthUser, articleId: string) {
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM articles WHERE tenant_id = $1 AND article_id = $2::uuid AND is_active = true`,
      [user.tenantId, articleId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('ARTICLE_NOT_IN_TENANT');
  }

  private async assertCashSession(user: AuthUser, siteId: string, cashSessionId: string) {
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM cash_sessions WHERE tenant_id = $1 AND cash_session_id = $2::uuid AND site_id = $3::uuid AND status = 'OPEN'`,
      [user.tenantId, cashSessionId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('CASH_SESSION_NOT_OPEN');
  }

  private async resolveUnitSnapshots(user: AuthUser, articleId: string, purchaseUnitId?: string, stockUnitId?: string) {
    const article = await this.db.query<{ sales_unit_id: string | null; packaging_unit_id: string | null; packaging: string | null }>(
      `SELECT sales_unit_id, packaging_unit_id, packaging FROM articles WHERE tenant_id = $1 AND article_id = $2::uuid LIMIT 1`,
      [user.tenantId, articleId],
    );
    const current = article.rows[0];
    const resolvedStockUnitId = stockUnitId ?? current?.sales_unit_id ?? current?.packaging_unit_id ?? null;
    const purchaseLabel = purchaseUnitId ? await this.unitLabel(user, purchaseUnitId) : current?.packaging ?? 'Unite';
    const stockLabel = resolvedStockUnitId ? await this.unitLabel(user, resolvedStockUnitId) : current?.packaging ?? 'Unite';
    return {
      purchaseUnitLabel: purchaseLabel || 'Unite',
      stockUnitId: resolvedStockUnitId,
      stockUnitLabel: stockLabel || 'Unite',
    };
  }

  private async unitLabel(user: AuthUser, productUnitId: string) {
    if (!productUnitId) return null;
    const result = await this.db.query<{ unit_label: string }>(
      `SELECT unit_label FROM product_units WHERE tenant_id = $1 AND product_unit_id = $2::uuid LIMIT 1`,
      [user.tenantId, productUnitId],
    );
    return result.rows[0]?.unit_label ?? null;
  }

  private async syncFinancials(tenantId: string, purchaseReturnId: string, clientOverride?: Pick<DatabaseService, 'query'> | { query: (sql: string, params?: unknown[]) => Promise<any> }) {
    const runner = clientOverride ?? this.db;
    const result = await runner.query(
      `
      WITH item_totals AS (
        SELECT COALESCE(SUM(line_return_value), 0)::numeric AS returned_value_usd
        FROM purchase_return_items
        WHERE tenant_id = $1
          AND purchase_return_id = $2::uuid
      ),
      replacement_totals AS (
        SELECT COALESCE(SUM(line_value), 0)::numeric AS replacement_value_usd
        FROM purchase_return_replacement_items
        WHERE tenant_id = $1
          AND purchase_return_id = $2::uuid
      ),
      settlement_totals AS (
        SELECT
          COALESCE(SUM(CASE WHEN settlement_kind = 'REFUND' THEN amount_equivalent_usd ELSE 0 END), 0)::numeric AS refunded_amount_usd,
          COALESCE(SUM(CASE WHEN settlement_kind = 'ADDITIONAL_PAYMENT' THEN amount_equivalent_usd ELSE 0 END), 0)::numeric AS additional_paid_usd,
          COALESCE(SUM(CASE WHEN settlement_kind = 'SUPPLIER_CREDIT' THEN amount_equivalent_usd ELSE 0 END), 0)::numeric AS supplier_credit_usd
        FROM purchase_return_settlements
        WHERE tenant_id = $1
          AND purchase_return_id = $2::uuid
      ),
      snapshot AS (
        SELECT
          item_totals.returned_value_usd,
          replacement_totals.replacement_value_usd,
          ROUND(item_totals.returned_value_usd - replacement_totals.replacement_value_usd, 2) AS financial_difference_usd,
          GREATEST(ROUND(item_totals.returned_value_usd - replacement_totals.replacement_value_usd, 2) - (settlement_totals.refunded_amount_usd + settlement_totals.supplier_credit_usd), 0)::numeric AS refund_due_usd,
          GREATEST(ROUND(replacement_totals.replacement_value_usd - item_totals.returned_value_usd, 2) - settlement_totals.additional_paid_usd, 0)::numeric AS additional_payment_due_usd,
          settlement_totals.supplier_credit_usd,
          settlement_totals.refunded_amount_usd,
          settlement_totals.additional_paid_usd
        FROM item_totals, replacement_totals, settlement_totals
      )
      UPDATE purchase_returns pr
      SET returned_value_usd = snapshot.returned_value_usd,
          replacement_value_usd = snapshot.replacement_value_usd,
          financial_difference_usd = snapshot.financial_difference_usd,
          refund_due_usd = snapshot.refund_due_usd,
          additional_payment_due_usd = snapshot.additional_payment_due_usd,
          supplier_credit_usd = snapshot.supplier_credit_usd,
          refunded_amount_usd = snapshot.refunded_amount_usd,
          additional_paid_usd = snapshot.additional_paid_usd
      FROM snapshot
      WHERE pr.tenant_id = $1
        AND pr.purchase_return_id = $2::uuid
      RETURNING pr.returned_value_usd, pr.replacement_value_usd, pr.financial_difference_usd,
                pr.refund_due_usd, pr.additional_payment_due_usd, pr.supplier_credit_usd,
                pr.refunded_amount_usd, pr.additional_paid_usd
      `,
      [tenantId, purchaseReturnId],
    );
    const row = result.rows[0];
    return {
      returnedValueUsd: Number(row?.returned_value_usd ?? 0),
      replacementValueUsd: Number(row?.replacement_value_usd ?? 0),
      financialDifferenceUsd: Number(row?.financial_difference_usd ?? 0),
      refundDueUsd: Number(row?.refund_due_usd ?? 0),
      additionalPaymentDueUsd: Number(row?.additional_payment_due_usd ?? 0),
      supplierCreditUsd: Number(row?.supplier_credit_usd ?? 0),
      refundedAmountUsd: Number(row?.refunded_amount_usd ?? 0),
      additionalPaidUsd: Number(row?.additional_paid_usd ?? 0),
    };
  }

  private toUsd(amount: number, currencyCode: string, exchangeRate: number) {
    if (currencyCode === 'CDF') return this.roundMoney(amount / Math.max(exchangeRate || 1, 1));
    return this.roundMoney(amount);
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private roundQuantity(value: number) {
    return Math.round(value * 1000) / 1000;
  }

  private startOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private async insertAudit(user: AuthUser, purchaseReturnId: string, actionType: string, payload: unknown) {
    await this.db.query(
      `
      INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
      VALUES ($1,$2,$3,'purchase_returns',$4,$5,$6::jsonb)
      `,
      [user.tenantId, user.siteId ?? null, user.userId, purchaseReturnId, actionType, JSON.stringify(payload)],
    );
  }

  private toPurchaseReturn(row: PurchaseReturnRow) {
    return {
      purchaseReturnId: row.purchase_return_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      purchaseId: row.purchase_id,
      purchaseNumber: row.purchase_number,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      returnNumber: row.return_number,
      returnDate: row.return_date,
      returnType: row.return_type,
      status: row.status,
      currencyCode: row.currency_code,
      exchangeRateApplied: Number(row.exchange_rate_applied),
      returnedValueUsd: Number(row.returned_value_usd),
      replacementValueUsd: Number(row.replacement_value_usd),
      financialDifferenceUsd: Number(row.financial_difference_usd),
      refundDueUsd: Number(row.refund_due_usd),
      additionalPaymentDueUsd: Number(row.additional_payment_due_usd),
      supplierCreditUsd: Number(row.supplier_credit_usd),
      refundedAmountUsd: Number(row.refunded_amount_usd),
      additionalPaidUsd: Number(row.additional_paid_usd),
      reason: row.reason,
      note: row.note,
      createdBy: row.created_by,
      validatedBy: row.validated_by,
      createdAt: row.created_at,
      validatedAt: row.validated_at,
      cancelledAt: row.cancelled_at,
    };
  }
}
