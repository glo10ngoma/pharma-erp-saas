import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreatePriceCheckDto, CreatePriceCheckItemDto } from './dto/create-price-check.dto';
import { ListPriceChecksDto } from './dto/list-price-checks.dto';

type PriceCheckRow = {
  price_check_id: string;
  tenant_id: string;
  site_id: string;
  site_name: string | null;
  check_number: string;
  customer_id: string | null;
  customer_name: string | null;
  patient_name: string | null;
  phone: string | null;
  currency_code: string;
  exchange_rate: string;
  subtotal_usd: string;
  total_usd: string;
  total_cdf: string;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
};

type PriceCheckItemRow = {
  price_check_item_id: string;
  price_check_id: string;
  article_id: string | null;
  article_code_snapshot: string | null;
  article_name_snapshot: string;
  requested_quantity: string;
  unit_id: string | null;
  unit_name_snapshot: string | null;
  unit_price: string | null;
  subtotal: string;
  availability_status: string;
  available_quantity_snapshot: string;
  manual_description: string | null;
  line_order: number;
};

type ArticleQuoteRow = {
  article_id: string;
  article_code: string;
  commercial_name: string;
  barcode: string | null;
  sales_unit_id: string | null;
  unit_label: string | null;
  available_quantity: string;
  unit_price: string | null;
};

@Injectable()
export class PriceChecksRepository {
  constructor(private readonly db: DatabaseService) {}

  async searchArticles(user: AuthUser, siteId: string, search = '') {
    const term = `%${search.trim()}%`;
    const result = await this.db.query<ArticleQuoteRow>(
      `
      SELECT
        a.article_id,
        a.article_code,
        a.commercial_name,
        a.barcode,
        a.sales_unit_id,
        pu.unit_label,
        COALESCE(SUM(st.quantity_available) FILTER (
          WHERE l.is_blocked = false
            AND l.expiry_date > CURRENT_DATE
        ), 0)::numeric AS available_quantity,
        COALESCE(
          MIN(l.selling_price) FILTER (
            WHERE st.quantity_available > 0
              AND l.is_blocked = false
              AND l.expiry_date > CURRENT_DATE
          ),
          MAX(l.selling_price)
        ) AS unit_price
      FROM articles a
      LEFT JOIN product_units pu ON pu.product_unit_id = a.sales_unit_id AND pu.tenant_id = a.tenant_id
      LEFT JOIN lots l ON l.article_id = a.article_id AND l.tenant_id = a.tenant_id
      LEFT JOIN stocks st ON st.lot_id = l.lot_id AND st.tenant_id = a.tenant_id AND st.site_id = $2
      WHERE a.tenant_id = $1
        AND a.is_active = true
        AND (
          $3 = '%%'
          OR a.article_code ILIKE $3
          OR a.commercial_name ILIKE $3
          OR a.barcode ILIKE $3
          OR a.dci ILIKE $3
        )
      GROUP BY a.article_id, pu.unit_label
      ORDER BY a.commercial_name ASC
      LIMIT 50
      `,
      [user.tenantId, siteId, term],
    );

    return result.rows.map((row) => this.toQuote(row, 1));
  }

  async list(user: AuthUser, query: ListPriceChecksDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const filters = ['pc.tenant_id = $1'];
    const params: unknown[] = [user.tenantId];

    if (query.siteId) {
      params.push(query.siteId);
      filters.push(`pc.site_id = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      filters.push(`(pc.check_number ILIKE $${params.length} OR pc.customer_name ILIKE $${params.length} OR pc.patient_name ILIKE $${params.length} OR pc.phone ILIKE $${params.length})`);
    }

    const where = filters.join(' AND ');
    const count = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM price_checks pc WHERE ${where}`,
      params,
    );
    const rows = await this.db.query<PriceCheckRow>(
      `
      SELECT pc.*, s.site_name, u.full_name AS created_by_name
      FROM price_checks pc
      LEFT JOIN sites s ON s.site_id = pc.site_id AND s.tenant_id = pc.tenant_id
      LEFT JOIN users u ON u.user_id = pc.created_by AND u.tenant_id = pc.tenant_id
      WHERE ${where}
      ORDER BY pc.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    return {
      items: rows.rows.map((row) => this.toPriceCheck(row, [])),
      total: Number(count.rows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  async findOne(user: AuthUser, id: string) {
    const header = await this.db.query<PriceCheckRow>(
      `
      SELECT pc.*, s.site_name, u.full_name AS created_by_name
      FROM price_checks pc
      LEFT JOIN sites s ON s.site_id = pc.site_id AND s.tenant_id = pc.tenant_id
      LEFT JOIN users u ON u.user_id = pc.created_by AND u.tenant_id = pc.tenant_id
      WHERE pc.tenant_id = $1 AND pc.price_check_id = $2
      LIMIT 1
      `,
      [user.tenantId, id],
    );
    if (!header.rows[0]) return null;

    const items = await this.findItems(user, id);
    return this.toPriceCheck(header.rows[0], items);
  }

  async create(user: AuthUser, dto: CreatePriceCheckDto) {
    const exchangeRate = await this.getExchangeRate(user);
    const quotedItems = await this.quoteItems(user, dto.siteId, dto.items);
    const totalUsd = this.roundMoney(quotedItems.reduce((sum, item) => sum + item.subtotal, 0));
    const totalCdf = this.roundMoney(totalUsd * exchangeRate);

    const createdId = await this.db.transaction(async (client) => {
      const checkNumber = await this.nextCheckNumber(user, client);
      const header = await client.query<{ price_check_id: string }>(
        `
        INSERT INTO price_checks (
          tenant_id, site_id, check_number, customer_id, customer_name, patient_name, phone,
          currency_code, exchange_rate, subtotal_usd, total_usd, total_cdf, notes, created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,'USD',$8,$9,$9,$10,$11,$12)
        RETURNING price_check_id
        `,
        [
          user.tenantId,
          dto.siteId,
          checkNumber,
          dto.customerId ?? null,
          dto.customerName?.trim() || null,
          dto.patientName?.trim() || null,
          dto.phone?.trim() || null,
          exchangeRate,
          totalUsd,
          totalCdf,
          dto.notes?.trim() || null,
          user.userId,
        ],
      );
      const priceCheckId = header.rows[0].price_check_id;

      for (const [index, item] of quotedItems.entries()) {
        await client.query(
          `
          INSERT INTO price_check_items (
            tenant_id, price_check_id, article_id, article_code_snapshot, article_name_snapshot,
            requested_quantity, unit_id, unit_name_snapshot, unit_price, subtotal,
            availability_status, available_quantity_snapshot, manual_description, line_order
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          `,
          [
            user.tenantId,
            priceCheckId,
            item.articleId,
            item.articleCode,
            item.articleName,
            item.requestedQuantity,
            item.unitId,
            item.unitName,
            item.unitPrice,
            item.subtotal,
            item.availabilityStatus,
            item.availableQuantity,
            item.manualDescription,
            index,
          ],
        );
      }

      return priceCheckId;
    });

    return this.findOne(user, createdId);
  }

  private async quoteItems(user: AuthUser, siteId: string, items: CreatePriceCheckItemDto[]) {
    const quoted = [];
    for (const item of items) {
      if (!item.articleId) {
        quoted.push({
          articleId: null,
          articleCode: null,
          articleName: item.manualDescription?.trim() || 'Produit non reference',
          requestedQuantity: item.requestedQuantity,
          unitId: null,
          unitName: null,
          unitPrice: null,
          subtotal: 0,
          availabilityStatus: 'UNREFERENCED',
          availableQuantity: 0,
          manualDescription: item.manualDescription?.trim() || null,
        });
        continue;
      }

      const result = await this.db.query<ArticleQuoteRow>(
        `
        SELECT
          a.article_id,
          a.article_code,
          a.commercial_name,
          a.barcode,
          a.sales_unit_id,
          pu.unit_label,
          COALESCE(SUM(st.quantity_available) FILTER (
            WHERE l.is_blocked = false
              AND l.expiry_date > CURRENT_DATE
          ), 0)::numeric AS available_quantity,
          COALESCE(
            MIN(l.selling_price) FILTER (
              WHERE st.quantity_available > 0
                AND l.is_blocked = false
                AND l.expiry_date > CURRENT_DATE
            ),
            MAX(l.selling_price)
          ) AS unit_price
        FROM articles a
        LEFT JOIN product_units pu ON pu.product_unit_id = a.sales_unit_id AND pu.tenant_id = a.tenant_id
        LEFT JOIN lots l ON l.article_id = a.article_id AND l.tenant_id = a.tenant_id
        LEFT JOIN stocks st ON st.lot_id = l.lot_id AND st.tenant_id = a.tenant_id AND st.site_id = $3
        WHERE a.tenant_id = $1 AND a.article_id = $2 AND a.is_active = true
        GROUP BY a.article_id, pu.unit_label
        LIMIT 1
        `,
        [user.tenantId, item.articleId, siteId],
      );
      const row = result.rows[0];
      if (!row) {
        quoted.push({
          articleId: null,
          articleCode: null,
          articleName: item.manualDescription?.trim() || 'Produit introuvable',
          requestedQuantity: item.requestedQuantity,
          unitId: null,
          unitName: null,
          unitPrice: null,
          subtotal: 0,
          availabilityStatus: 'UNREFERENCED',
          availableQuantity: 0,
          manualDescription: item.manualDescription?.trim() || null,
        });
        continue;
      }
      const quote = this.toQuote(row, item.requestedQuantity);
      quoted.push({
        articleId: row.article_id,
        articleCode: row.article_code,
        articleName: row.commercial_name,
        requestedQuantity: item.requestedQuantity,
        unitId: row.sales_unit_id,
        unitName: row.unit_label,
        unitPrice: quote.unitPrice,
        subtotal: quote.subtotal,
        availabilityStatus: quote.availabilityStatus,
        availableQuantity: quote.availableQuantity,
        manualDescription: null,
      });
    }
    return quoted;
  }

  private async findItems(user: AuthUser, id: string) {
    const result = await this.db.query<PriceCheckItemRow>(
      `
      SELECT *
      FROM price_check_items
      WHERE tenant_id = $1 AND price_check_id = $2
      ORDER BY line_order ASC, created_at ASC
      `,
      [user.tenantId, id],
    );
    return result.rows.map((row) => ({
      priceCheckItemId: row.price_check_item_id,
      priceCheckId: row.price_check_id,
      articleId: row.article_id,
      articleCode: row.article_code_snapshot,
      articleName: row.article_name_snapshot,
      requestedQuantity: Number(row.requested_quantity),
      unitId: row.unit_id,
      unitName: row.unit_name_snapshot,
      unitPrice: row.unit_price === null ? null : Number(row.unit_price),
      subtotal: Number(row.subtotal),
      availabilityStatus: row.availability_status,
      availableQuantity: Number(row.available_quantity_snapshot),
      manualDescription: row.manual_description,
      lineOrder: row.line_order,
    }));
  }

  private async getExchangeRate(user: AuthUser) {
    const result = await this.db.query<{ setting_value: string }>(
      `SELECT setting_value FROM tenant_settings WHERE tenant_id = $1 AND setting_key = 'USD_CDF_RATE' LIMIT 1`,
      [user.tenantId],
    );
    const rate = Number(result.rows[0]?.setting_value ?? 1);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  }

  private async nextCheckNumber(user: AuthUser, client: Pick<PoolClient, 'query'>) {
    const today = new Date().toISOString().slice(0, 10);
    const prefix = `CHK-${today.replace(/-/g, '')}`;
    const result = await client.query<{ next_number: number }>(
      `
      INSERT INTO price_check_counters (tenant_id, counter_date, last_sequence)
      VALUES ($1, $2::date, 1)
      ON CONFLICT (tenant_id, counter_date)
      DO UPDATE SET
        last_sequence = price_check_counters.last_sequence + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING last_sequence AS next_number
      `,
      [user.tenantId, today],
    );
    return `${prefix}-${String(Number(result.rows[0]?.next_number ?? 1)).padStart(4, '0')}`;
  }

  private toQuote(row: ArticleQuoteRow, requestedQuantity: number) {
    const availableQuantity = Number(row.available_quantity ?? 0);
    const unitPrice = row.unit_price === null ? null : Number(row.unit_price);
    const subtotal = unitPrice === null ? 0 : this.roundMoney(requestedQuantity * unitPrice);
    const availabilityStatus = availableQuantity <= 0
      ? 'UNAVAILABLE'
      : availableQuantity < requestedQuantity
        ? 'INSUFFICIENT_STOCK'
        : 'AVAILABLE';
    return {
      articleId: row.article_id,
      articleCode: row.article_code,
      articleName: row.commercial_name,
      barcode: row.barcode,
      unitId: row.sales_unit_id,
      unitName: row.unit_label,
      unitPrice,
      requestedQuantity,
      subtotal,
      availableQuantity,
      availabilityStatus,
    };
  }

  private toPriceCheck(row: PriceCheckRow, items: Awaited<ReturnType<PriceChecksRepository['findItems']>>) {
    return {
      priceCheckId: row.price_check_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      checkNumber: row.check_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      patientName: row.patient_name,
      phone: row.phone,
      currencyCode: row.currency_code,
      exchangeRate: Number(row.exchange_rate),
      subtotalUsd: Number(row.subtotal_usd),
      totalUsd: Number(row.total_usd),
      totalCdf: Number(row.total_cdf),
      notes: row.notes,
      status: row.status,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      items,
    };
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
