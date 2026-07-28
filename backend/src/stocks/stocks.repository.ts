import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { ListStockSummaryDto } from './dto/list-stock-summary.dto';
import { StockDetailQueryDto } from './dto/stock-detail-query.dto';

type StockRow = { stock_id: string; tenant_id: string; site_id: string; site_name: string | null; lot_id: string; lot_number: string; expiry_date: string; article_id: string; article_code: string | null; commercial_name: string | null; quantity_available: string; quantity_reserved: string; stock_min: string; stock_max: string | null; updated_at: Date };
type StockSummaryRow = {
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  dci: string | null;
  site_id: string;
  site_name: string | null;
  quantity_available: string;
  quantity_reserved: string;
  quantity_total: string;
  stock_min: string;
  purchase_value: string;
  sale_value: string;
  next_expiry_date: string | null;
  total_count: string;
};
type StockDetailRow = {
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  dci: string | null;
  site_id: string;
  site_name: string | null;
  lot_id: string;
  lot_number: string;
  expiry_date: string;
  quantity_available: string;
  quantity_reserved: string;
  stock_min: string;
  purchase_price: string | null;
  selling_price: string | null;
};
type MovementRow = {
  movement_id: string;
  movement_date: Date;
  movement_type: string;
  quantity: string;
  reference_type: string | null;
  lot_id: string | null;
  lot_number: string | null;
};

@Injectable()
export class StocksRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<StockRow>(this.baseSql('WHERE st.tenant_id=$1 AND ($2::uuid IS NULL OR st.site_id=$2::uuid) ORDER BY a.commercial_name, l.expiry_date'), [user.tenantId, user.siteId ?? null]); return r.rows.map(this.toDto); }
  async findByArticle(user: AuthUser, articleId: string) { const r = await this.db.query<StockRow>(this.baseSql('WHERE st.tenant_id=$1 AND l.article_id=$2 AND ($3::uuid IS NULL OR st.site_id=$3::uuid) ORDER BY l.expiry_date'), [user.tenantId, articleId, user.siteId ?? null]); return r.rows.map(this.toDto); }
  async findSummary(user: AuthUser, query: ListStockSummaryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const params: unknown[] = [user.tenantId, user.siteId ?? null, query.siteId ?? null];
    const filters = ['1=1'];

    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      filters.push(`(
        article_code ILIKE $${params.length}
        OR commercial_name ILIKE $${params.length}
        OR dci ILIKE $${params.length}
        OR site_name ILIKE $${params.length}
      )`);
    }

    if (query.categoryId) {
      params.push(query.categoryId);
      filters.push(`category_id = $${params.length}::uuid`);
    }

    if (query.status && query.status !== 'ALL') {
      params.push(query.status);
      filters.push(`status_code = $${params.length}`);
    }

    if (query.expiryStatus && query.expiryStatus !== 'ALL') {
      const threshold30 = new Date();
      threshold30.setDate(threshold30.getDate() + 30);
      const threshold90 = new Date();
      threshold90.setDate(threshold90.getDate() + 90);
      params.push(threshold30.toISOString().slice(0, 10));
      const p30 = params.length;
      params.push(threshold90.toISOString().slice(0, 10));
      const p90 = params.length;
      if (query.expiryStatus === 'EXPIRED') filters.push(`next_expiry_date IS NOT NULL AND next_expiry_date < CURRENT_DATE`);
      if (query.expiryStatus === 'UNDER_30') filters.push(`next_expiry_date IS NOT NULL AND next_expiry_date >= CURRENT_DATE AND next_expiry_date <= $${p30}::date`);
      if (query.expiryStatus === 'UNDER_90') filters.push(`next_expiry_date IS NOT NULL AND next_expiry_date >= CURRENT_DATE AND next_expiry_date <= $${p90}::date`);
      if (query.expiryStatus === 'VALID') filters.push(`next_expiry_date IS NULL OR next_expiry_date > $${p90}::date`);
    }

    params.push(limit, offset);
    const rows = await this.db.query<StockSummaryRow>(
      `
      WITH aggregated AS (
        SELECT
          a.article_id,
          a.article_code,
          a.commercial_name,
          a.dci,
          a.category_id,
          st.site_id,
          s.site_name,
          SUM(st.quantity_available)::numeric AS quantity_available,
          SUM(st.quantity_reserved)::numeric AS quantity_reserved,
          (SUM(st.quantity_available) + SUM(st.quantity_reserved))::numeric AS quantity_total,
          MAX(COALESCE(st.stock_min, a.default_stock_min, 0))::numeric AS stock_min,
          SUM(st.quantity_available * COALESCE(l.purchase_price, 0))::numeric AS purchase_value,
          SUM(st.quantity_available * COALESCE(l.selling_price, 0))::numeric AS sale_value,
          MIN(l.expiry_date) FILTER (WHERE st.quantity_available > 0 AND l.expiry_date IS NOT NULL) AS next_expiry_date
        FROM stocks st
        JOIN lots l ON l.lot_id = st.lot_id AND l.tenant_id = st.tenant_id
        JOIN articles a ON a.article_id = l.article_id AND a.tenant_id = st.tenant_id
        JOIN sites s ON s.site_id = st.site_id AND s.tenant_id = st.tenant_id
        WHERE st.tenant_id = $1
          AND ($2::uuid IS NULL OR st.site_id = $2::uuid)
          AND ($3::uuid IS NULL OR st.site_id = $3::uuid)
        GROUP BY a.article_id, a.article_code, a.commercial_name, a.dci, a.category_id, st.site_id, s.site_name
      ),
      filtered AS (
        SELECT
          *,
          CASE
            WHEN quantity_available <= 0 THEN 'OUT'
            WHEN quantity_reserved > 0 THEN 'RESERVED'
            WHEN quantity_available <= stock_min THEN 'LOW'
            ELSE 'AVAILABLE'
          END AS status_code
        FROM aggregated
        WHERE ${filters.join(' AND ')}
      )
      SELECT
        article_id,
        article_code,
        commercial_name,
        dci,
        site_id,
        site_name,
        quantity_available,
        quantity_reserved,
        quantity_total,
        stock_min,
        purchase_value,
        sale_value,
        next_expiry_date,
        COUNT(*) OVER()::int AS total_count
      FROM filtered
      ORDER BY commercial_name ASC, site_name ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
      `,
      params,
    );

    return {
      items: rows.rows.map((row) => this.toSummaryDto(row)),
      page,
      limit,
      total: Number(rows.rows[0]?.total_count ?? 0),
      totalPages: Math.max(1, Math.ceil(Number(rows.rows[0]?.total_count ?? 0) / limit)),
    };
  }
  async findDetail(user: AuthUser, query: StockDetailQueryDto) {
    if (user.siteId && user.siteId !== query.siteId) return null;
    const lots = await this.db.query<StockDetailRow>(
      `
      SELECT
        a.article_id,
        a.article_code,
        a.commercial_name,
        a.dci,
        st.site_id,
        s.site_name,
        l.lot_id,
        l.lot_number,
        l.expiry_date,
        st.quantity_available,
        st.quantity_reserved,
        COALESCE(st.stock_min, a.default_stock_min, 0)::numeric AS stock_min,
        l.purchase_price,
        l.selling_price
      FROM stocks st
      JOIN lots l ON l.lot_id = st.lot_id AND l.tenant_id = st.tenant_id
      JOIN articles a ON a.article_id = l.article_id AND a.tenant_id = st.tenant_id
      JOIN sites s ON s.site_id = st.site_id AND s.tenant_id = st.tenant_id
      WHERE st.tenant_id = $1
        AND a.article_id = $2
        AND st.site_id = $3
      ORDER BY l.expiry_date ASC, l.lot_number ASC
      `,
      [user.tenantId, query.articleId, query.siteId],
    );
    if (!lots.rows[0]) return null;

    const movements = await this.db.query<MovementRow>(
      `
      SELECT
        sm.movement_id,
        sm.movement_date,
        sm.movement_type,
        sm.quantity,
        sm.reference_type,
        sm.lot_id,
        l.lot_number
      FROM stock_movements sm
      LEFT JOIN lots l ON l.lot_id = sm.lot_id AND l.tenant_id = sm.tenant_id
      WHERE sm.tenant_id = $1
        AND sm.article_id = $2
        AND sm.site_id = $3
      ORDER BY sm.movement_date DESC
      LIMIT 20
      `,
      [user.tenantId, query.articleId, query.siteId],
    );

    const first = lots.rows[0];
    const detailLots = lots.rows.map((row) => ({
      lotId: row.lot_id,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date,
      quantityAvailable: Number(row.quantity_available),
      quantityReserved: Number(row.quantity_reserved),
      purchasePrice: Number(row.purchase_price ?? 0),
      sellingPrice: Number(row.selling_price ?? 0),
    }));
    const quantityAvailable = detailLots.reduce((sum, lot) => sum + lot.quantityAvailable, 0);
    const quantityReserved = detailLots.reduce((sum, lot) => sum + lot.quantityReserved, 0);

    return {
      articleId: first.article_id,
      articleCode: first.article_code,
      articleName: first.commercial_name,
      dci: first.dci,
      siteId: first.site_id,
      siteName: first.site_name,
      quantityAvailable,
      quantityReserved,
      quantityTotal: quantityAvailable + quantityReserved,
      stockMin: Math.max(...lots.rows.map((row) => Number(row.stock_min ?? 0))),
      purchaseValue: detailLots.reduce((sum, lot) => sum + lot.quantityAvailable * lot.purchasePrice, 0),
      saleValue: detailLots.reduce((sum, lot) => sum + lot.quantityAvailable * lot.sellingPrice, 0),
      lots: detailLots,
      movements: movements.rows.map((row) => ({
        movementId: row.movement_id,
        movementDate: row.movement_date,
        movementType: row.movement_type,
        quantity: Number(row.quantity),
        referenceType: row.reference_type,
        lotId: row.lot_id,
        lotNumber: row.lot_number,
      })),
    };
  }
  private baseSql(where: string) { return `SELECT st.stock_id, st.tenant_id, st.site_id, s.site_name, st.lot_id, l.lot_number, l.expiry_date, l.article_id, a.article_code, a.commercial_name, st.quantity_available, st.quantity_reserved, st.stock_min, st.stock_max, st.updated_at FROM stocks st JOIN lots l ON l.lot_id=st.lot_id AND l.tenant_id=st.tenant_id JOIN articles a ON a.article_id=l.article_id AND a.tenant_id=st.tenant_id JOIN sites s ON s.site_id=st.site_id AND s.tenant_id=st.tenant_id ${where}`; }
  private toDto(row: StockRow) { return { stockId: row.stock_id, tenantId: row.tenant_id, siteId: row.site_id, siteName: row.site_name, lotId: row.lot_id, lotNumber: row.lot_number, expiryDate: row.expiry_date, articleId: row.article_id, articleCode: row.article_code, commercialName: row.commercial_name, quantityAvailable: Number(row.quantity_available), quantityReserved: Number(row.quantity_reserved), stockMin: Number(row.stock_min), stockMax: row.stock_max === null ? null : Number(row.stock_max), updatedAt: row.updated_at }; }
  private toSummaryDto(row: StockSummaryRow) {
    return {
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      dci: row.dci,
      siteId: row.site_id,
      siteName: row.site_name,
      quantityAvailable: Number(row.quantity_available),
      quantityReserved: Number(row.quantity_reserved),
      quantityTotal: Number(row.quantity_total),
      stockMin: Number(row.stock_min),
      purchaseValue: Number(row.purchase_value),
      saleValue: Number(row.sale_value),
      nextExpiryDate: row.next_expiry_date,
      statusCode: this.statusCode(Number(row.quantity_available), Number(row.quantity_reserved), Number(row.stock_min)),
    };
  }
  private statusCode(quantityAvailable: number, quantityReserved: number, stockMin: number) {
    if (quantityAvailable <= 0) return 'OUT';
    if (quantityReserved > 0) return 'RESERVED';
    if (quantityAvailable <= stockMin) return 'LOW';
    return 'AVAILABLE';
  }
}
