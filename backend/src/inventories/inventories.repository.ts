import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { AddInventoryItemDto } from './dto/add-inventory-item.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

type InventoryRow = { inventory_id: string; tenant_id: string; site_id: string; site_name: string | null; inventory_number: string; inventory_type: string; inventory_date: string; status: string; notes: string | null; created_by: string | null; validated_by: string | null; created_at: Date; validated_at: Date | null };
type ItemRow = { inventory_item_id: string; tenant_id: string; inventory_id: string; article_id: string; article_code: string | null; commercial_name: string | null; lot_id: string; lot_number: string | null; expiry_date: string | null; stock_unit_label: string | null; system_quantity: string; counted_quantity: string | null; difference_quantity: string | null; reason: string | null; counted_by: string | null; counted_at: Date | null };

@Injectable()
export class InventoriesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const r = await this.db.query<InventoryRow>(
      this.baseSql(`WHERE inv.tenant_id=$1 AND ($2::uuid IS NULL OR inv.site_id=$2::uuid) ORDER BY inv.created_at DESC`),
      [user.tenantId, user.siteId ?? null],
    );
    return r.rows.map(this.toInventory);
  }

  async findOne(user: AuthUser, id: string) {
    const r = await this.db.query<InventoryRow>(
      this.baseSql(`WHERE inv.tenant_id=$1 AND inv.inventory_id=$2 AND ($3::uuid IS NULL OR inv.site_id=$3::uuid) LIMIT 1`),
      [user.tenantId, id, user.siteId ?? null],
    );
    if (!r.rows[0]) return null;
    return { ...this.toInventory(r.rows[0]), items: await this.findItems(user, id) };
  }

  async create(user: AuthUser, dto: CreateInventoryDto) {
    await this.assertSiteAllowed(user, dto.siteId);
    const number = `INV-${Date.now()}`;
    const r = await this.db.query<{ inventory_id: string }>(
      `INSERT INTO inventory_sessions (tenant_id, site_id, inventory_number, inventory_type, inventory_date, status, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5::date,CURRENT_DATE),'DRAFT',$6,$7)
       RETURNING inventory_id`,
      [user.tenantId, dto.siteId, number, dto.inventoryType ?? 'FULL', dto.inventoryDate ?? null, dto.notes ?? null, user.userId],
    );
    await this.writeAudit(this.db, user, 'inventory_sessions', r.rows[0].inventory_id, 'CREATE', { inventoryNumber: number, status: 'DRAFT', siteId: dto.siteId });
    return this.findOne(user, r.rows[0].inventory_id);
  }

  async start(user: AuthUser, id: string) {
    const inv = await this.findOne(user, id);
    if (!inv) return null;
    if (inv.status !== 'DRAFT') throw new Error('INVENTORY_NOT_DRAFT');
    await this.db.query(`UPDATE inventory_sessions SET status='IN_PROGRESS' WHERE tenant_id=$1 AND inventory_id=$2`, [user.tenantId, id]);
    await this.writeAudit(this.db, user, 'inventory_sessions', id, 'START', { inventoryNumber: inv.inventoryNumber, status: 'IN_PROGRESS' });
    return this.findOne(user, id);
  }

  async close(user: AuthUser, id: string) {
    const inv = await this.findOne(user, id);
    if (!inv) return null;
    if (inv.status !== 'IN_PROGRESS') throw new Error('INVENTORY_NOT_IN_PROGRESS');
    const counts = await this.countItems(user, id);
    if (counts.totalCount === 0) throw new Error('INVENTORY_EMPTY');
    if (counts.emptyCount > 0) throw new Error('INVENTORY_ITEMS_NOT_FULLY_COUNTED');
    await this.db.query(`UPDATE inventory_sessions SET status='CLOSED' WHERE tenant_id=$1 AND inventory_id=$2`, [user.tenantId, id]);
    await this.writeAudit(this.db, user, 'inventory_sessions', id, 'CLOSE', { inventoryNumber: inv.inventoryNumber, status: 'CLOSED', ...counts });
    return this.findOne(user, id);
  }

  async addItem(user: AuthUser, id: string, dto: AddInventoryItemDto) {
    const inv = await this.findOne(user, id);
    if (!inv) return null;
    if (inv.status === 'VALIDATED') throw new Error('INVENTORY_VALIDATED_LOCKED');
    if (inv.status !== 'IN_PROGRESS') throw new Error('INVENTORY_NOT_IN_PROGRESS');
    const systemQuantity = await this.currentSystemQuantity(user, inv.siteId, dto.articleId, dto.lotId);
    const physical = dto.physicalQuantity ?? null;
    const result = await this.db.query<{ inventory_item_id: string; counted_quantity: string | null; difference_quantity: string | null }>(
      `INSERT INTO inventory_items (tenant_id, inventory_id, article_id, lot_id, system_quantity, counted_quantity, difference_quantity, reason, counted_by, counted_at)
       VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6::numeric IS NULL THEN NULL ELSE $6::numeric - $5::numeric END,$7,$8,CASE WHEN $6::numeric IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END)
       ON CONFLICT (inventory_id, lot_id) DO UPDATE
       SET counted_quantity=EXCLUDED.counted_quantity,
           difference_quantity=EXCLUDED.difference_quantity,
           reason=EXCLUDED.reason,
           counted_by=EXCLUDED.counted_by,
           counted_at=EXCLUDED.counted_at
       RETURNING inventory_item_id, counted_quantity, difference_quantity`,
      [user.tenantId, id, dto.articleId, dto.lotId, systemQuantity, physical, dto.reason ?? null, user.userId],
    );
    await this.writeAudit(this.db, user, 'inventory_items', result.rows[0].inventory_item_id, 'COUNT', {
      inventoryId: id,
      physicalQuantity: result.rows[0].counted_quantity === null ? null : Number(result.rows[0].counted_quantity),
      differenceQuantity: result.rows[0].difference_quantity === null ? null : Number(result.rows[0].difference_quantity),
      reason: dto.reason ?? null,
    });
    return this.findItems(user, id);
  }

  async updateItem(user: AuthUser, id: string, itemId: string, dto: UpdateInventoryItemDto) {
    const inv = await this.findOne(user, id);
    if (!inv) return null;
    if (inv.status === 'VALIDATED') throw new Error('INVENTORY_VALIDATED_LOCKED');
    if (inv.status !== 'IN_PROGRESS') throw new Error('INVENTORY_NOT_IN_PROGRESS');
    const result = await this.db.query<{ inventory_item_id: string; counted_quantity: string | null; difference_quantity: string | null; reason: string | null }>(
      `UPDATE inventory_items
       SET counted_quantity=COALESCE($4, counted_quantity),
           difference_quantity=COALESCE($4, counted_quantity) - system_quantity,
           reason=COALESCE($5, reason),
           counted_by=$6,
           counted_at=CURRENT_TIMESTAMP
       WHERE tenant_id=$1 AND inventory_id=$2 AND inventory_item_id=$3
       RETURNING inventory_item_id, counted_quantity, difference_quantity, reason`,
      [user.tenantId, id, itemId, dto.physicalQuantity ?? null, dto.reason ?? null, user.userId],
    );
    if (!result.rows[0]) throw new Error('INVENTORY_ITEM_NOT_FOUND');
    await this.writeAudit(this.db, user, 'inventory_items', itemId, 'COUNT', {
      inventoryId: id,
      physicalQuantity: result.rows[0].counted_quantity === null ? null : Number(result.rows[0].counted_quantity),
      differenceQuantity: result.rows[0].difference_quantity === null ? null : Number(result.rows[0].difference_quantity),
      reason: result.rows[0].reason,
    });
    return this.findItems(user, id);
  }

  async fillEmptyWithZero(user: AuthUser, id: string) {
    const inv = await this.findOne(user, id);
    if (!inv) return null;
    if (inv.status !== 'IN_PROGRESS') throw new Error('INVENTORY_NOT_IN_PROGRESS');
    const counts = await this.countItems(user, id);
    if (counts.emptyCount === 0) {
      return {
        inventory: inv,
        updatedCount: 0,
        totalCount: counts.totalCount,
        alreadyCountedCount: counts.countedCount,
      };
    }

    let updatedCount = 0;
    await this.db.transaction(async (client) => {
      const updated = await client.query<{ inventory_item_id: string }>(
        `UPDATE inventory_items
         SET counted_quantity=0,
             difference_quantity=0 - system_quantity,
             counted_by=$3,
             counted_at=CURRENT_TIMESTAMP
         WHERE tenant_id=$1
           AND inventory_id=$2
           AND counted_quantity IS NULL
         RETURNING inventory_item_id`,
        [user.tenantId, id, user.userId],
      );
      updatedCount = Number(updated.rowCount ?? 0);
      await this.writeAudit(client, user, 'inventory_sessions', id, 'FILL_EMPTY_ZERO', {
        inventoryId: id,
        updatedCount,
        totalCount: counts.totalCount,
        alreadyCountedCount: counts.countedCount,
      });
    });

    return {
      inventory: await this.findOne(user, id),
      updatedCount,
      totalCount: counts.totalCount,
      alreadyCountedCount: counts.countedCount,
    };
  }

  async validate(user: AuthUser, id: string) {
    await this.db.transaction(async (client) => {
      const invResult = await client.query<InventoryRow>(
        this.baseSql(`WHERE inv.tenant_id=$1 AND inv.inventory_id=$2 AND ($3::uuid IS NULL OR inv.site_id=$3::uuid) FOR UPDATE OF inv`),
        [user.tenantId, id, user.siteId ?? null],
      );
      const inv = invResult.rows[0];
      if (!inv) throw new Error('INVENTORY_NOT_FOUND');
      if (inv.status === 'VALIDATED') throw new Error('INVENTORY_ALREADY_VALIDATED');
      if (inv.status !== 'CLOSED') throw new Error('INVENTORY_NOT_CLOSED');
      const items = await client.query<ItemRow>(
        `SELECT ii.inventory_item_id, ii.tenant_id, ii.inventory_id, ii.article_id, NULL::text AS article_code,
                NULL::text AS commercial_name, ii.lot_id, NULL::text AS lot_number, NULL::date AS expiry_date, NULL::text AS stock_unit_label,
                ii.system_quantity, ii.counted_quantity, ii.difference_quantity, ii.reason, ii.counted_by, ii.counted_at
         FROM inventory_items ii
         WHERE ii.tenant_id=$1 AND ii.inventory_id=$2`,
        [user.tenantId, id],
      );
      if (!items.rows.length) throw new Error('INVENTORY_EMPTY');
      for (const item of items.rows) {
        if (item.counted_quantity === null) throw new Error('INVENTORY_ITEM_NOT_COUNTED');
        const difference = Number(item.counted_quantity) - Number(item.system_quantity);
        await client.query(`UPDATE inventory_items SET difference_quantity=$4 WHERE tenant_id=$1 AND inventory_id=$2 AND inventory_item_id=$3`, [user.tenantId, id, item.inventory_item_id, difference]);
        if (difference === 0) continue;
        const type = difference > 0 ? 'INVENTORY_GAIN' : 'INVENTORY_LOSS';
        const quantity = Math.abs(difference);
        const stock = await client.query<{ stock_id: string; quantity_available: string }>(
          `SELECT stock_id, quantity_available FROM stocks WHERE tenant_id=$1 AND site_id=$2 AND lot_id=$3 FOR UPDATE`,
          [user.tenantId, inv.site_id, item.lot_id],
        );
        const row = stock.rows[0];
        if (!row) throw new Error('STOCK_NOT_FOUND');
        const newQuantity = Number(row.quantity_available) + difference;
        if (newQuantity < 0) throw new Error('STOCK_INSUFFICIENT');
        await client.query(
          `INSERT INTO stock_movements (tenant_id, site_id, article_id, lot_id, movement_type, quantity, reference_type, reference_id, notes, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,'INVENTORY',$7,$8,$9)`,
          [user.tenantId, inv.site_id, item.article_id, item.lot_id, type, quantity, id, `Validation inventaire ${inv.inventory_number}`, user.userId],
        );
        await client.query(
          `UPDATE stocks SET quantity_available=$4, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND site_id=$2 AND lot_id=$3`,
          [user.tenantId, inv.site_id, item.lot_id, newQuantity],
        );
      }
      await client.query(`UPDATE inventory_sessions SET status='VALIDATED', validated_by=$3, validated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND inventory_id=$2`, [user.tenantId, id, user.userId]);
      await this.writeAudit(client, user, 'inventory_sessions', id, 'VALIDATE', { status: 'VALIDATED', inventoryNumber: inv.inventory_number });
    });
    return this.findOne(user, id);
  }

  async findItems(user: AuthUser, id: string) {
    const r = await this.db.query<ItemRow>(
      `SELECT ii.inventory_item_id, ii.tenant_id, ii.inventory_id, ii.article_id, a.article_code, a.commercial_name,
              ii.lot_id, l.lot_number, l.expiry_date,
              COALESCE(su.unit_label, pu.unit_label, NULLIF(a.packaging, ''), 'Non renseignee') AS stock_unit_label,
              ii.system_quantity, ii.counted_quantity,
              ii.difference_quantity, ii.reason, ii.counted_by, ii.counted_at
       FROM inventory_items ii
       JOIN inventory_sessions inv ON inv.inventory_id=ii.inventory_id AND inv.tenant_id=ii.tenant_id
       JOIN articles a ON a.article_id=ii.article_id AND a.tenant_id=ii.tenant_id
       JOIN lots l ON l.lot_id=ii.lot_id AND l.tenant_id=ii.tenant_id
       LEFT JOIN product_units su ON su.product_unit_id=a.sales_unit_id AND su.tenant_id=a.tenant_id
       LEFT JOIN product_units pu ON pu.product_unit_id=a.packaging_unit_id AND pu.tenant_id=a.tenant_id
       WHERE ii.tenant_id=$1 AND ii.inventory_id=$2 AND ($3::uuid IS NULL OR inv.site_id=$3::uuid)
       ORDER BY ii.system_quantity DESC, a.commercial_name ASC, l.expiry_date ASC`,
      [user.tenantId, id, user.siteId ?? null],
    );
    return r.rows.map(this.toItem);
  }

  private async countItems(user: AuthUser, id: string) {
    const result = await this.db.query<{ total_count: string; counted_count: string; empty_count: string; zero_count: string }>(
      `SELECT COUNT(*)::int AS total_count,
              COUNT(*) FILTER (WHERE counted_quantity IS NOT NULL)::int AS counted_count,
              COUNT(*) FILTER (WHERE counted_quantity IS NULL)::int AS empty_count,
              COUNT(*) FILTER (WHERE counted_quantity = 0)::int AS zero_count
       FROM inventory_items
       WHERE tenant_id=$1 AND inventory_id=$2`,
      [user.tenantId, id],
    );
    return {
      totalCount: Number(result.rows[0]?.total_count ?? 0),
      countedCount: Number(result.rows[0]?.counted_count ?? 0),
      emptyCount: Number(result.rows[0]?.empty_count ?? 0),
      zeroCount: Number(result.rows[0]?.zero_count ?? 0),
    };
  }

  private async currentSystemQuantity(user: AuthUser, siteId: string, articleId: string, lotId: string) {
    const r = await this.db.query<{ quantity_available: string }>(
      `SELECT st.quantity_available
       FROM stocks st
       JOIN lots l ON l.lot_id=st.lot_id AND l.tenant_id=st.tenant_id
       WHERE st.tenant_id=$1 AND st.site_id=$2 AND st.lot_id=$3 AND l.article_id=$4`,
      [user.tenantId, siteId, lotId, articleId],
    );
    if (!r.rows[0]) throw new Error('STOCK_NOT_FOUND');
    return Number(r.rows[0].quantity_available);
  }

  private async assertSiteAllowed(user: AuthUser, siteId: string) {
    if (user.siteId && user.siteId !== siteId) throw new Error('SITE_NOT_ALLOWED');
    const r = await this.db.query<{ total: string }>(`SELECT COUNT(*)::int AS total FROM sites WHERE tenant_id=$1 AND site_id=$2 AND is_active=true`, [user.tenantId, siteId]);
    if (Number(r.rows[0]?.total ?? 0) !== 1) throw new Error('SITE_NOT_IN_TENANT');
  }

  private async writeAudit(
    runner: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    user: AuthUser,
    tableName: string,
    recordId: string,
    actionType: string,
    payload: Record<string, unknown>,
  ) {
    const normalizedAction = normalizeInventoryAuditAction(actionType);
    await runner.query(
      `INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [user.tenantId, user.userId, tableName, recordId, normalizedAction, JSON.stringify({ event: actionType, ...payload })],
    );
  }

  private baseSql(where: string) {
    return `SELECT inv.inventory_id, inv.tenant_id, inv.site_id, s.site_name, inv.inventory_number, inv.inventory_type, inv.inventory_date, inv.status, inv.notes, inv.created_by, inv.validated_by, inv.created_at, inv.validated_at FROM inventory_sessions inv JOIN sites s ON s.site_id=inv.site_id AND s.tenant_id=inv.tenant_id ${where}`;
  }
  private toInventory(row: InventoryRow) { return { inventoryId: row.inventory_id, tenantId: row.tenant_id, siteId: row.site_id, siteName: row.site_name, inventoryNumber: row.inventory_number, inventoryType: row.inventory_type, inventoryDate: row.inventory_date, status: row.status, notes: row.notes, createdBy: row.created_by, validatedBy: row.validated_by, createdAt: row.created_at, validatedAt: row.validated_at }; }
  private toItem(row: ItemRow) { return { inventoryItemId: row.inventory_item_id, inventoryId: row.inventory_id, articleId: row.article_id, articleCode: row.article_code, commercialName: row.commercial_name, lotId: row.lot_id, lotNumber: row.lot_number, expiryDate: row.expiry_date, stockUnitLabel: row.stock_unit_label ?? 'Non renseignee', systemQuantity: Number(row.system_quantity), physicalQuantity: row.counted_quantity === null ? null : Number(row.counted_quantity), differenceQuantity: row.difference_quantity === null ? null : Number(row.difference_quantity), reason: row.reason, countedBy: row.counted_by, countedAt: row.counted_at }; }
}

function normalizeInventoryAuditAction(actionType: string) {
  if (actionType === 'CREATE') return 'INSERT';
  if (actionType === 'VALIDATE') return 'VALIDATE';
  if (actionType === 'CANCEL') return 'CANCEL';
  return 'UPDATE';
}
