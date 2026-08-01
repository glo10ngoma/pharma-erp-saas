import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';

type MovementRow = {
  movement_id: string;
  tenant_id: string;
  movement_date: Date;
  site_id: string;
  site_name: string | null;
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  dci: string | null;
  lot_id: string | null;
  lot_number: string | null;
  movement_type: string;
  quantity: string;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  reference_label: string | null;
  notes: string | null;
  user_id: string | null;
  user_name: string | null;
  unit_label: string | null;
  is_blocked: boolean | null;
  block_reason: string | null;
  total_count?: number;
};

type SummaryRow = {
  movement_count: string;
  articles_count: string;
  lots_count: string;
  users_count: string;
  entry_count: string;
  exit_count: string;
  purchase_in_count: string;
  sale_out_count: string;
  inventory_gain_count: string;
  inventory_loss_count: string;
  transfer_in_count: string;
  transfer_out_count: string;
  purchase_return_out_count: string;
  purchase_exchange_in_count: string;
};

const ENTRY_TYPES = [
  'PURCHASE_IN',
  'TRANSFER_IN',
  'INVENTORY_GAIN',
  'PURCHASE_EXCHANGE_IN',
  'MANUAL_ADJUSTMENT_IN',
  'STOCK_ENTRY',
  'ADJUSTMENT_IN',
  'RETURN_IN',
];

const EXIT_TYPES = [
  'SALE_OUT',
  'TRANSFER_OUT',
  'INVENTORY_LOSS',
  'PURCHASE_RETURN_OUT',
  'MANUAL_ADJUSTMENT_OUT',
  'STOCK_OUTPUT',
  'ADJUSTMENT_OUT',
  'RETURN_OUT',
  'EXPIRED_OUT',
  'DAMAGED_OUT',
];

@Injectable()
export class StockMovementsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser, query: ListStockMovementsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const { joins, filters, params } = this.buildScope(user, query);

    const rows = await this.db.query<MovementRow>(
      `
      WITH filtered AS (
        SELECT
          sm.movement_id,
          sm.tenant_id,
          sm.movement_date,
          sm.site_id,
          s.site_name,
          sm.article_id,
          a.article_code,
          a.commercial_name,
          a.dci,
          sm.lot_id,
          l.lot_number,
          l.is_blocked,
          l.block_reason,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          COALESCE(
            p.purchase_number,
            sa.sale_number,
            inv.inventory_number,
            tr.transfer_number,
            pr.return_number
          ) AS reference_number,
          CASE
            WHEN sm.reference_type = 'PURCHASE' THEN 'Achat'
            WHEN sm.reference_type = 'SALE' THEN 'Vente'
            WHEN sm.reference_type = 'INVENTORY' THEN 'Inventaire'
            WHEN sm.reference_type = 'TRANSFER' THEN 'Transfert'
            WHEN sm.reference_type = 'PURCHASE_RETURN' THEN 'Retour fournisseur'
            ELSE NULL
          END AS reference_label,
          sm.notes,
          sm.user_id,
          u.full_name AS user_name,
          NULL::text AS unit_label,
          COUNT(*) OVER()::int AS total_count
        FROM stock_movements sm
        JOIN sites s ON s.site_id = sm.site_id AND s.tenant_id = sm.tenant_id
        JOIN articles a ON a.article_id = sm.article_id AND a.tenant_id = sm.tenant_id
        LEFT JOIN lots l ON l.lot_id = sm.lot_id AND l.tenant_id = sm.tenant_id
        LEFT JOIN users u ON u.user_id = sm.user_id AND u.tenant_id = sm.tenant_id
        ${joins}
        WHERE ${filters.join(' AND ')}
      )
      SELECT *
      FROM filtered
      ORDER BY ${this.orderClause(query)}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    const summary = await this.db.query<SummaryRow>(
      `
      SELECT
        COUNT(*)::int AS movement_count,
        COUNT(DISTINCT sm.article_id)::int AS articles_count,
        COUNT(DISTINCT sm.lot_id)::int AS lots_count,
        COUNT(DISTINCT sm.user_id)::int AS users_count,
        SUM(CASE WHEN sm.movement_type = ANY($${params.length + 1}::text[]) THEN 1 ELSE 0 END)::int AS entry_count,
        SUM(CASE WHEN sm.movement_type = ANY($${params.length + 2}::text[]) THEN 1 ELSE 0 END)::int AS exit_count,
        SUM(CASE WHEN sm.movement_type = 'PURCHASE_IN' THEN 1 ELSE 0 END)::int AS purchase_in_count,
        SUM(CASE WHEN sm.movement_type = 'SALE_OUT' THEN 1 ELSE 0 END)::int AS sale_out_count,
        SUM(CASE WHEN sm.movement_type = 'INVENTORY_GAIN' THEN 1 ELSE 0 END)::int AS inventory_gain_count,
        SUM(CASE WHEN sm.movement_type = 'INVENTORY_LOSS' THEN 1 ELSE 0 END)::int AS inventory_loss_count,
        SUM(CASE WHEN sm.movement_type = 'TRANSFER_IN' THEN 1 ELSE 0 END)::int AS transfer_in_count,
        SUM(CASE WHEN sm.movement_type = 'TRANSFER_OUT' THEN 1 ELSE 0 END)::int AS transfer_out_count,
        SUM(CASE WHEN sm.movement_type = 'PURCHASE_RETURN_OUT' THEN 1 ELSE 0 END)::int AS purchase_return_out_count,
        SUM(CASE WHEN sm.movement_type = 'PURCHASE_EXCHANGE_IN' THEN 1 ELSE 0 END)::int AS purchase_exchange_in_count
      FROM stock_movements sm
      JOIN sites s ON s.site_id = sm.site_id AND s.tenant_id = sm.tenant_id
      JOIN articles a ON a.article_id = sm.article_id AND a.tenant_id = sm.tenant_id
      LEFT JOIN lots l ON l.lot_id = sm.lot_id AND l.tenant_id = sm.tenant_id
      LEFT JOIN users u ON u.user_id = sm.user_id AND u.tenant_id = sm.tenant_id
      ${joins}
      WHERE ${filters.join(' AND ')}
      `,
      [...params, ENTRY_TYPES, EXIT_TYPES],
    );

    const total = Number(rows.rows[0]?.total_count ?? 0);
    return {
      items: rows.rows.map((row) => this.toDto(row)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: this.toSummary(summary.rows[0]),
    };
  }

  async export(user: AuthUser, query: ListStockMovementsDto) {
    const exportQuery = { ...query, page: 1, limit: 5000 };
    const result = await this.findAll(user, exportQuery);
    return {
      items: result.items,
      summary: result.summary,
      exportedAt: new Date().toISOString(),
      truncated: result.total > result.items.length,
      total: result.total,
    };
  }

  private buildScope(user: AuthUser, query: ListStockMovementsDto) {
    const params: unknown[] = [user.tenantId, user.siteId ?? null, query.siteId ?? null];
    const filters = [
      'sm.tenant_id = $1',
      '($2::uuid IS NULL OR sm.site_id = $2::uuid)',
      '($3::uuid IS NULL OR sm.site_id = $3::uuid)',
    ];

    if (query.dateFrom) {
      params.push(query.dateFrom);
      filters.push(`sm.movement_date >= $${params.length}::date`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      filters.push(`sm.movement_date < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      filters.push(`(
        a.article_code ILIKE $${params.length}
        OR a.commercial_name ILIKE $${params.length}
        OR a.dci ILIKE $${params.length}
        OR COALESCE(l.lot_number, '') ILIKE $${params.length}
        OR COALESCE(p.purchase_number, '') ILIKE $${params.length}
        OR COALESCE(sa.sale_number, '') ILIKE $${params.length}
        OR COALESCE(inv.inventory_number, '') ILIKE $${params.length}
        OR COALESCE(tr.transfer_number, '') ILIKE $${params.length}
        OR COALESCE(pr.return_number, '') ILIKE $${params.length}
        OR COALESCE(sm.notes, '') ILIKE $${params.length}
      )`);
    }

    if (query.articleId) {
      params.push(query.articleId);
      filters.push(`sm.article_id = $${params.length}::uuid`);
    }

    if (query.lotId) {
      params.push(query.lotId);
      filters.push(`sm.lot_id = $${params.length}::uuid`);
    }

    if (query.movementType) {
      params.push(query.movementType);
      filters.push(`sm.movement_type = $${params.length}`);
    }

    if (query.direction) {
      const values = query.direction === 'IN' ? ENTRY_TYPES : EXIT_TYPES;
      params.push(values);
      filters.push(`sm.movement_type = ANY($${params.length}::text[])`);
    }

    if (query.userId) {
      params.push(query.userId);
      filters.push(`sm.user_id = $${params.length}::uuid`);
    }

    if (query.referenceType) {
      params.push(query.referenceType);
      filters.push(`sm.reference_type = $${params.length}`);
    }

    if (query.referenceId) {
      params.push(query.referenceId);
      filters.push(`sm.reference_id = $${params.length}::uuid`);
    }

    const joins = `
      LEFT JOIN purchases p
        ON sm.reference_type = 'PURCHASE'
       AND p.purchase_id = sm.reference_id
       AND p.tenant_id = sm.tenant_id
      LEFT JOIN sales sa
        ON sm.reference_type = 'SALE'
       AND sa.sale_id = sm.reference_id
       AND sa.tenant_id = sm.tenant_id
      LEFT JOIN inventory_sessions inv
        ON sm.reference_type = 'INVENTORY'
       AND inv.inventory_id = sm.reference_id
       AND inv.tenant_id = sm.tenant_id
      LEFT JOIN stock_transfers tr
        ON sm.reference_type = 'TRANSFER'
       AND tr.transfer_id = sm.reference_id
       AND tr.tenant_id = sm.tenant_id
      LEFT JOIN purchase_returns pr
        ON sm.reference_type = 'PURCHASE_RETURN'
       AND pr.purchase_return_id = sm.reference_id
       AND pr.tenant_id = sm.tenant_id
    `;

    return { params, filters, joins };
  }

  private orderClause(query: ListStockMovementsDto) {
    const direction = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    if (query.sortBy === 'quantity') return `quantity ${direction}, movement_date DESC`;
    if (query.sortBy === 'article') return `commercial_name ${direction}, movement_date DESC`;
    if (query.sortBy === 'movementType') return `movement_type ${direction}, movement_date DESC`;
    return `movement_date ${direction}, movement_id DESC`;
  }

  private movementDirection(type: string) {
    if (ENTRY_TYPES.includes(type)) return 'IN';
    if (EXIT_TYPES.includes(type)) return 'OUT';
    return 'OTHER';
  }

  private toDto(row: MovementRow) {
    return {
      movementId: row.movement_id,
      movementDate: row.movement_date,
      siteId: row.site_id,
      siteName: row.site_name,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      dci: row.dci,
      lotId: row.lot_id,
      lotNumber: row.lot_number,
      movementType: row.movement_type,
      direction: this.movementDirection(row.movement_type),
      quantity: Number(row.quantity),
      unitLabel: row.unit_label,
      stockBefore: null,
      stockAfter: null,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      referenceNumber: row.reference_number,
      referenceLabel: row.reference_label,
      notes: row.notes,
      userId: row.user_id,
      userName: row.user_name,
      workstationId: null,
      workstationName: null,
      isBlocked: Boolean(row.is_blocked),
      blockReason: row.block_reason,
    };
  }

  private toSummary(row?: SummaryRow) {
    return {
      movementCount: Number(row?.movement_count ?? 0),
      articlesCount: Number(row?.articles_count ?? 0),
      lotsCount: Number(row?.lots_count ?? 0),
      usersCount: Number(row?.users_count ?? 0),
      entryCount: Number(row?.entry_count ?? 0),
      exitCount: Number(row?.exit_count ?? 0),
      purchaseInCount: Number(row?.purchase_in_count ?? 0),
      saleOutCount: Number(row?.sale_out_count ?? 0),
      inventoryGainCount: Number(row?.inventory_gain_count ?? 0),
      inventoryLossCount: Number(row?.inventory_loss_count ?? 0),
      transferInCount: Number(row?.transfer_in_count ?? 0),
      transferOutCount: Number(row?.transfer_out_count ?? 0),
      purchaseReturnOutCount: Number(row?.purchase_return_out_count ?? 0),
      purchaseExchangeInCount: Number(row?.purchase_exchange_in_count ?? 0),
      mixedUnits: true,
    };
  }
}
