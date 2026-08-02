import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { ConfirmFefoActionDto } from './dto/confirm-fefo-action.dto';
import { RemoveExpiredStockDto } from './dto/remove-expired-stock.dto';

type LotRow = {
  lot_id: string;
  tenant_id: string;
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  lot_number: string;
  expiry_date: string;
  purchase_price: string;
  selling_price: string;
  currency_id: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  created_at: Date;
};

type FefoActionRow = {
  fefo_action_id: string;
  tenant_id: string;
  site_id: string;
  site_name: string | null;
  article_id: string;
  article_code: string | null;
  article_name: string | null;
  lot_id: string;
  lot_number: string | null;
  priority_at_action: string;
  action_type: string;
  action_status: string;
  quantity: string | null;
  note: string | null;
  request_key: string | null;
  stock_movement_id: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_at: Date;
  created_at: Date;
};

type StockContextRow = {
  stock_id: string;
  tenant_id: string;
  site_id: string;
  site_name: string | null;
  article_id: string;
  article_code: string | null;
  article_name: string | null;
  lot_id: string;
  lot_number: string;
  expiry_date: string;
  quantity_available: string;
  quantity_reserved: string;
  purchase_price: string | null;
  selling_price: string | null;
  is_blocked: boolean;
  block_reason: string | null;
};

type InsertedFefoActionRow = {
  fefo_action_id: string;
  performed_at: Date;
};

type MovementInsertRow = {
  movement_id: string;
  movement_date: Date;
};

type ExistingRequestRow = {
  fefo_action_id: string;
};

type LatestActionRow = {
  action_type: string;
  action_status: string;
  performed_at: Date;
};

type FefoPriority = 'EXPIRED' | 'BLOCKED' | 'RED' | 'ORANGE' | 'GREEN';

@Injectable()
export class LotsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const r = await this.db.query<LotRow>(
      this.baseSql('WHERE l.tenant_id=$1 AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM stocks st WHERE st.tenant_id=l.tenant_id AND st.lot_id=l.lot_id AND st.site_id=$2::uuid)) ORDER BY l.expiry_date ASC'),
      [user.tenantId, user.siteId ?? null],
    );
    return r.rows.map(this.toDto);
  }

  async findFefoActions(user: AuthUser, siteId?: string) {
    if (user.siteId && siteId && user.siteId !== siteId) {
      throw new BadRequestException('SITE_NOT_ALLOWED');
    }

    const result = await this.db.query<FefoActionRow>(
      `
      SELECT
        fa.fefo_action_id,
        fa.tenant_id,
        fa.site_id,
        s.site_name,
        fa.article_id,
        a.article_code,
        a.commercial_name AS article_name,
        fa.lot_id,
        l.lot_number,
        fa.priority_at_action,
        fa.action_type,
        fa.action_status,
        fa.quantity,
        fa.note,
        fa.request_key,
        fa.stock_movement_id,
        fa.performed_by,
        u.full_name AS performed_by_name,
        fa.performed_at,
        fa.created_at
      FROM fefo_actions fa
      JOIN sites s ON s.site_id = fa.site_id
      JOIN articles a ON a.article_id = fa.article_id
      JOIN lots l ON l.lot_id = fa.lot_id
      LEFT JOIN users u ON u.user_id = fa.performed_by
      WHERE fa.tenant_id = $1
        AND ($2::uuid IS NULL OR fa.site_id = $2::uuid)
        AND ($3::uuid IS NULL OR fa.site_id = $3::uuid)
      ORDER BY fa.performed_at DESC, fa.created_at DESC
      `,
      [user.tenantId, user.siteId ?? null, siteId ?? null],
    );

    return result.rows.map((row) => this.toFefoAction(row));
  }

  async findOne(user: AuthUser, id: string) {
    const r = await this.db.query<LotRow>(
      this.baseSql('WHERE l.tenant_id=$1 AND l.lot_id=$2 AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM stocks st WHERE st.tenant_id=l.tenant_id AND st.lot_id=l.lot_id AND st.site_id=$3::uuid)) LIMIT 1'),
      [user.tenantId, id, user.siteId ?? null],
    );
    return r.rows[0] ? this.toDto(r.rows[0]) : null;
  }

  async block(user: AuthUser, id: string, reason?: string) {
    await this.db.query(
      `UPDATE lots l SET is_blocked=true, block_reason=$3 WHERE tenant_id=$1 AND lot_id=$2 AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM stocks st WHERE st.tenant_id=l.tenant_id AND st.lot_id=l.lot_id AND st.site_id=$4::uuid))`,
      [user.tenantId, id, reason ?? 'Blocked', user.siteId ?? null],
    );
    return this.findOne(user, id);
  }

  async unblock(user: AuthUser, id: string) {
    await this.db.query(
      `UPDATE lots l SET is_blocked=false, block_reason=NULL WHERE tenant_id=$1 AND lot_id=$2 AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM stocks st WHERE st.tenant_id=l.tenant_id AND st.lot_id=l.lot_id AND st.site_id=$3::uuid))`,
      [user.tenantId, id, user.siteId ?? null],
    );
    return this.findOne(user, id);
  }

  async confirmFefoAction(user: AuthUser, lotId: string, dto: ConfirmFefoActionDto) {
    return this.db.transaction(async (client) => {
      const existingByRequest = dto.requestKey
        ? await client.query<ExistingRequestRow>(
            `SELECT fefo_action_id FROM fefo_actions WHERE tenant_id = $1 AND request_key = $2 LIMIT 1`,
            [user.tenantId, dto.requestKey],
          )
        : null;

      if (existingByRequest?.rows[0]) {
        return this.findFefoActionById(user.tenantId, existingByRequest.rows[0].fefo_action_id, client);
      }

      const stock = await this.lockStockContext(client, user, lotId, dto.siteId);
      const priority = this.resolvePriority(stock.expiry_date, stock.is_blocked);

      if (dto.actionType === 'HIGHLIGHT_CONFIRMED' && priority !== 'RED') {
        throw new BadRequestException('FEFO_ACTION_REQUIRES_RED_PRIORITY');
      }
      if (dto.actionType === 'SHELF_ROTATION_CONFIRMED' && priority !== 'ORANGE') {
        throw new BadRequestException('FEFO_ACTION_REQUIRES_ORANGE_PRIORITY');
      }

      if (Number(stock.quantity_available) <= 0) {
        throw new BadRequestException('LOT_OUT_OF_STOCK');
      }

      const latest = await client.query<LatestActionRow>(
        `
        SELECT action_type, action_status, performed_at
        FROM fefo_actions
        WHERE tenant_id = $1
          AND site_id = $2
          AND lot_id = $3
          AND action_type = $4
        ORDER BY performed_at DESC
        LIMIT 1
        `,
        [user.tenantId, dto.siteId, lotId, dto.actionType],
      );

      if (latest.rows[0]?.action_status === 'COMPLETED' && this.isSameBusinessDay(latest.rows[0].performed_at)) {
        throw new BadRequestException('FEFO_ACTION_ALREADY_CONFIRMED_TODAY');
      }

      const inserted = await client.query<InsertedFefoActionRow>(
        `
        INSERT INTO fefo_actions (
          tenant_id, site_id, article_id, lot_id, priority_at_action, action_type, action_status,
          note, request_key, performed_by, performed_at, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,'COMPLETED',$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        RETURNING fefo_action_id, performed_at
        `,
        [user.tenantId, dto.siteId, stock.article_id, lotId, priority, dto.actionType, this.cleanNote(dto.note), dto.requestKey ?? null, user.userId],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1,$2,'fefo_actions',$3,'INSERT',$4::jsonb)
        `,
        [
          user.tenantId,
          user.userId,
          inserted.rows[0].fefo_action_id,
          JSON.stringify({
            event: 'FEFO_ACTION_CONFIRMED',
            actionType: dto.actionType,
            priority,
            siteId: dto.siteId,
            lotId,
            articleId: stock.article_id,
            note: this.cleanNote(dto.note),
          }),
        ],
      );

      return this.findFefoActionById(user.tenantId, inserted.rows[0].fefo_action_id, client);
    });
  }

  async removeExpiredStock(user: AuthUser, lotId: string, dto: RemoveExpiredStockDto) {
    return this.db.transaction(async (client) => {
      const existingByRequest = dto.requestKey
        ? await client.query<ExistingRequestRow>(
            `SELECT fefo_action_id FROM fefo_actions WHERE tenant_id = $1 AND request_key = $2 LIMIT 1`,
            [user.tenantId, dto.requestKey],
          )
        : null;

      if (existingByRequest?.rows[0]) {
        return this.findFefoActionById(user.tenantId, existingByRequest.rows[0].fefo_action_id, client);
      }

      const stock = await this.lockStockContext(client, user, lotId, dto.siteId);
      const priority = this.resolvePriority(stock.expiry_date, stock.is_blocked);
      const quantityAvailable = Number(stock.quantity_available ?? 0);
      const quantity = Number(dto.quantity);

      if (priority !== 'EXPIRED') {
        throw new BadRequestException('LOT_NOT_EXPIRED');
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException('QUANTITY_INVALID');
      }
      if (quantity > quantityAvailable) {
        throw new BadRequestException('QUANTITY_EXCEEDS_AVAILABLE_STOCK');
      }

      const insertedAction = await client.query<InsertedFefoActionRow>(
        `
        INSERT INTO fefo_actions (
          tenant_id, site_id, article_id, lot_id, priority_at_action, action_type, action_status,
          quantity, note, request_key, performed_by, performed_at, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,'EXPIRED','REMOVED_EXPIRED','COMPLETED',$5,$6,$7,$8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        RETURNING fefo_action_id, performed_at
        `,
        [user.tenantId, dto.siteId, stock.article_id, lotId, quantity, this.cleanNote(dto.note), dto.requestKey ?? null, user.userId],
      );

      await client.query(
        `UPDATE stocks SET quantity_available = quantity_available - $2, updated_at = CURRENT_TIMESTAMP WHERE stock_id = $1 AND tenant_id = $3`,
        [stock.stock_id, quantity, user.tenantId],
      );

      const movement = await client.query<MovementInsertRow>(
        `
        INSERT INTO stock_movements (
          tenant_id, site_id, article_id, lot_id, movement_type, quantity, reference_type, reference_id, notes, user_id
        )
        VALUES ($1,$2,$3,$4,'EXPIRED_OUT',$5,'LOT_EXPIRY_ACTION',$6,$7,$8)
        RETURNING movement_id, movement_date
        `,
        [
          user.tenantId,
          dto.siteId,
          stock.article_id,
          lotId,
          quantity,
          insertedAction.rows[0].fefo_action_id,
          this.buildExpiryMovementNote(dto.reason, dto.note),
          user.userId,
        ],
      );

      await client.query(
        `UPDATE fefo_actions SET stock_movement_id = $3, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND fefo_action_id = $2`,
        [user.tenantId, insertedAction.rows[0].fefo_action_id, movement.rows[0].movement_id],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1,$2,'fefo_actions',$3,'INSERT',$4::jsonb)
        `,
        [
          user.tenantId,
          user.userId,
          insertedAction.rows[0].fefo_action_id,
          JSON.stringify({
            event: 'FEFO_EXPIRED_STOCK_REMOVED',
            actionType: 'REMOVED_EXPIRED',
            siteId: dto.siteId,
            articleId: stock.article_id,
            lotId,
            quantity,
            stockBefore: quantityAvailable,
            stockAfter: quantityAvailable - quantity,
            note: this.cleanNote(dto.note),
          }),
        ],
      );

      return this.findFefoActionById(user.tenantId, insertedAction.rows[0].fefo_action_id, client);
    });
  }

  private async lockStockContext(client: { query: <T = any>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> }, user: AuthUser, lotId: string, siteId: string) {
    if (user.siteId && user.siteId !== siteId) {
      throw new BadRequestException('SITE_NOT_ALLOWED');
    }

    const result = await client.query<StockContextRow>(
      `
      SELECT
        st.stock_id,
        st.tenant_id,
        st.site_id,
        s.site_name,
        l.article_id,
        a.article_code,
        a.commercial_name AS article_name,
        st.lot_id,
        l.lot_number,
        l.expiry_date,
        st.quantity_available,
        st.quantity_reserved,
        l.purchase_price,
        l.selling_price,
        l.is_blocked,
        l.block_reason
      FROM stocks st
      JOIN lots l ON l.lot_id = st.lot_id AND l.tenant_id = st.tenant_id
      JOIN articles a ON a.article_id = l.article_id AND a.tenant_id = st.tenant_id
      JOIN sites s ON s.site_id = st.site_id AND s.tenant_id = st.tenant_id
      WHERE st.tenant_id = $1
        AND st.lot_id = $2
        AND st.site_id = $3
        AND ($4::uuid IS NULL OR st.site_id = $4::uuid)
      FOR UPDATE OF st, l
      `,
      [user.tenantId, lotId, siteId, user.siteId ?? null],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('LOT_STOCK_NOT_FOUND');
    }

    return result.rows[0];
  }

  private async findFefoActionById(
    tenantId: string,
    actionId: string,
    client: { query: <T = any>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  ) {
    const result = await client.query<FefoActionRow>(
      `
      SELECT
        fa.fefo_action_id,
        fa.tenant_id,
        fa.site_id,
        s.site_name,
        fa.article_id,
        a.article_code,
        a.commercial_name AS article_name,
        fa.lot_id,
        l.lot_number,
        fa.priority_at_action,
        fa.action_type,
        fa.action_status,
        fa.quantity,
        fa.note,
        fa.request_key,
        fa.stock_movement_id,
        fa.performed_by,
        u.full_name AS performed_by_name,
        fa.performed_at,
        fa.created_at
      FROM fefo_actions fa
      JOIN sites s ON s.site_id = fa.site_id
      JOIN articles a ON a.article_id = fa.article_id
      JOIN lots l ON l.lot_id = fa.lot_id
      LEFT JOIN users u ON u.user_id = fa.performed_by
      WHERE fa.tenant_id = $1 AND fa.fefo_action_id = $2
      LIMIT 1
      `,
      [tenantId, actionId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('FEFO_ACTION_NOT_FOUND');
    }

    return this.toFefoAction(result.rows[0]);
  }

  private resolvePriority(expiryDate: string, isBlocked: boolean): FefoPriority {
    const daysRemaining = this.daysUntil(expiryDate);
    if (daysRemaining <= 0) return 'EXPIRED';
    if (isBlocked) return 'BLOCKED';
    if (daysRemaining <= 30) return 'RED';
    if (daysRemaining <= 90) return 'ORANGE';
    return 'GREEN';
  }

  private daysUntil(expiryDate: string) {
    const target = new Date(`${String(expiryDate).split('T')[0]}T00:00:00`);
    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.floor((target.getTime() - current.getTime()) / (24 * 60 * 60 * 1000));
  }

  private isSameBusinessDay(date: Date) {
    const current = new Date();
    return current.getFullYear() === date.getFullYear()
      && current.getMonth() === date.getMonth()
      && current.getDate() === date.getDate();
  }

  private cleanNote(note?: string | null) {
    const value = String(note ?? '').trim();
    return value || null;
  }

  private buildExpiryMovementNote(reason?: string | null, note?: string | null) {
    const parts = ['Rotation des rayons - sortie pour peremption'];
    const cleanedReason = this.cleanNote(reason);
    const cleanedNote = this.cleanNote(note);
    if (cleanedReason) parts.push(`Motif: ${cleanedReason}`);
    if (cleanedNote) parts.push(cleanedNote);
    return parts.join(' | ');
  }

  private baseSql(where: string) {
    return `SELECT l.lot_id, l.tenant_id, l.article_id, a.article_code, a.commercial_name, l.supplier_id, s.supplier_name, l.lot_number, l.expiry_date, l.purchase_price, l.selling_price, l.currency_id, c.currency_code, CASE WHEN c.currency_code='CDF' THEN 'FC' WHEN c.currency_code='USD' THEN '$' ELSE c.currency_code END AS currency_symbol, l.is_blocked, l.block_reason, l.created_at FROM lots l JOIN articles a ON a.article_id=l.article_id AND a.tenant_id=l.tenant_id LEFT JOIN suppliers s ON s.supplier_id=l.supplier_id AND s.tenant_id=l.tenant_id LEFT JOIN currencies c ON c.currency_id=l.currency_id ${where}`;
  }

  private toDto(row: LotRow) {
    return {
      lotId: row.lot_id,
      tenantId: row.tenant_id,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date,
      purchasePrice: Number(row.purchase_price),
      sellingPrice: Number(row.selling_price),
      currencyId: row.currency_id,
      currencyCode: row.currency_code,
      currencySymbol: row.currency_symbol,
      isBlocked: row.is_blocked,
      blockReason: row.block_reason,
      createdAt: row.created_at,
    };
  }

  private toFefoAction(row: FefoActionRow) {
    return {
      fefoActionId: row.fefo_action_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      articleId: row.article_id,
      articleCode: row.article_code,
      articleName: row.article_name,
      lotId: row.lot_id,
      lotNumber: row.lot_number,
      priorityAtAction: row.priority_at_action,
      actionType: row.action_type,
      actionStatus: row.action_status,
      quantity: row.quantity === null ? null : Number(row.quantity),
      note: row.note,
      requestKey: row.request_key,
      stockMovementId: row.stock_movement_id,
      performedBy: row.performed_by,
      performedByName: row.performed_by_name,
      performedAt: row.performed_at,
      createdAt: row.created_at,
    };
  }
}
