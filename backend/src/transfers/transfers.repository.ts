import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { AddTransferItemDto } from './dto/add-transfer-item.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

type TransferRow = {
  transfer_id: string;
  tenant_id: string;
  transfer_number: string;
  from_site_id: string;
  from_site_name: string | null;
  to_site_id: string;
  to_site_name: string | null;
  transfer_date: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  sent_at: Date | null;
  received_at: Date | null;
};

type TransferItemRow = {
  transfer_item_id: string;
  transfer_id: string;
  tenant_id: string;
  article_id: string;
  article_code: string | null;
  commercial_name: string | null;
  lot_id: string;
  lot_number: string | null;
  expiry_date: string | null;
  quantity_requested: string;
  quantity_sent: string | null;
  quantity_received: string | null;
  notes: string | null;
};

@Injectable()
export class TransfersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser, status?: string) {
    const params: unknown[] = [user.tenantId, user.siteId ?? null];
    const filters = ['tr.tenant_id = $1', '($2::uuid IS NULL OR tr.from_site_id = $2::uuid OR tr.to_site_id = $2::uuid)'];
    if (status) {
      params.push(status === 'VALIDATED' ? 'RECEIVED' : status);
      filters.push(`tr.status = $${params.length}`);
    }
    const result = await this.db.query<TransferRow>(
      `
      SELECT tr.transfer_id, tr.tenant_id, tr.transfer_number, tr.from_site_id,
             fs.site_name AS from_site_name, tr.to_site_id, ts.site_name AS to_site_name,
             tr.transfer_date, tr.status, tr.notes, tr.created_by, tr.created_at,
             tr.sent_at, tr.received_at
      FROM stock_transfers tr
      JOIN sites fs ON fs.site_id = tr.from_site_id AND fs.tenant_id = tr.tenant_id
      JOIN sites ts ON ts.site_id = tr.to_site_id AND ts.tenant_id = tr.tenant_id
      WHERE ${filters.join(' AND ')}
      ORDER BY tr.created_at DESC
      `,
      params,
    );
    return result.rows.map(this.toTransfer);
  }

  async findOne(user: AuthUser, id: string) {
    const transfer = await this.db.query<TransferRow>(
      `
      SELECT tr.transfer_id, tr.tenant_id, tr.transfer_number, tr.from_site_id,
             fs.site_name AS from_site_name, tr.to_site_id, ts.site_name AS to_site_name,
             tr.transfer_date, tr.status, tr.notes, tr.created_by, tr.created_at,
             tr.sent_at, tr.received_at
      FROM stock_transfers tr
      JOIN sites fs ON fs.site_id = tr.from_site_id AND fs.tenant_id = tr.tenant_id
      JOIN sites ts ON ts.site_id = tr.to_site_id AND ts.tenant_id = tr.tenant_id
      WHERE tr.tenant_id = $1 AND tr.transfer_id = $2
        AND ($3::uuid IS NULL OR tr.from_site_id = $3::uuid OR tr.to_site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, id, user.siteId ?? null],
    );
    if (!transfer.rows[0]) return null;
    const items = await this.findItems(user, id);
    return { ...this.toTransfer(transfer.rows[0]), items };
  }

  async create(user: AuthUser, dto: CreateTransferDto) {
    await this.assertSites(user, dto.fromSiteId, dto.toSiteId);
    const number = dto.transferNumber?.trim() || `TRF-${Date.now()}`;
    const result = await this.db.query<{ transfer_id: string }>(
      `
      INSERT INTO stock_transfers (
        tenant_id, transfer_number, from_site_id, to_site_id, transfer_date, notes, created_by
      )
      VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7)
      RETURNING transfer_id
      `,
      [user.tenantId, number, dto.fromSiteId, dto.toSiteId, dto.transferDate ?? null, dto.notes ?? null, user.userId],
    );
    return this.findOne(user, result.rows[0].transfer_id);
  }

  async addItem(user: AuthUser, transferId: string, dto: AddTransferItemDto) {
    const transfer = await this.findOne(user, transferId);
    if (!transfer) return null;
    if (transfer.status !== 'DRAFT') throw new Error('TRANSFER_NOT_DRAFT');
    if (dto.quantity <= 0) throw new Error('INVALID_TRANSFER_QUANTITY');
    await this.assertArticleLot(user, dto.articleId, dto.lotId);
    await this.db.query(
      `
      INSERT INTO stock_transfer_items (
        tenant_id, transfer_id, article_id, lot_id, quantity_requested, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [user.tenantId, transferId, dto.articleId, dto.lotId, dto.quantity, dto.notes ?? null],
    );
    return this.findOne(user, transferId);
  }

  async removeItem(user: AuthUser, transferId: string, itemId: string) {
    const transfer = await this.findOne(user, transferId);
    if (!transfer) return null;
    if (transfer.status !== 'DRAFT') throw new Error('TRANSFER_NOT_DRAFT');
    await this.db.query(
      `DELETE FROM stock_transfer_items WHERE tenant_id=$1 AND transfer_id=$2 AND transfer_item_id=$3`,
      [user.tenantId, transferId, itemId],
    );
    return this.findOne(user, transferId);
  }

  async validate(user: AuthUser, transferId: string) {
    await this.db.transaction(async (client) => {
      const transferResult = await client.query<TransferRow>(
        `
        SELECT tr.transfer_id, tr.tenant_id, tr.transfer_number, tr.from_site_id,
               NULL::text AS from_site_name, tr.to_site_id, NULL::text AS to_site_name,
               tr.transfer_date, tr.status, tr.notes, tr.created_by, tr.created_at,
               tr.sent_at, tr.received_at
        FROM stock_transfers tr
        WHERE tr.tenant_id=$1 AND tr.transfer_id=$2
          AND ($3::uuid IS NULL OR tr.from_site_id=$3::uuid)
        FOR UPDATE
        `,
        [user.tenantId, transferId, user.siteId ?? null],
      );
      const transfer = transferResult.rows[0];
      if (!transfer) throw new Error('TRANSFER_NOT_FOUND');
      if (transfer.status !== 'DRAFT') throw new Error('TRANSFER_NOT_DRAFT');

      const items = await client.query<TransferItemRow>(
        `
        SELECT ti.transfer_item_id, ti.transfer_id, ti.tenant_id, ti.article_id,
               NULL::text AS article_code, NULL::text AS commercial_name,
               ti.lot_id, NULL::text AS lot_number, NULL::date AS expiry_date,
               ti.quantity_requested, ti.quantity_sent, ti.quantity_received, ti.notes
        FROM stock_transfer_items ti
        JOIN articles a ON a.article_id = ti.article_id AND a.tenant_id = ti.tenant_id
        JOIN lots l ON l.lot_id = ti.lot_id AND l.tenant_id = ti.tenant_id AND l.article_id = ti.article_id
        WHERE ti.tenant_id=$1 AND ti.transfer_id=$2
        `,
        [user.tenantId, transferId],
      );
      if (!items.rows.length) throw new Error('TRANSFER_EMPTY');

      for (const item of items.rows) {
        const quantity = Number(item.quantity_requested);
        if (quantity <= 0) throw new Error('INVALID_TRANSFER_QUANTITY');

        const stockResult = await client.query<{ quantity_available: string }>(
          `
          SELECT quantity_available
          FROM stocks
          WHERE tenant_id=$1 AND site_id=$2 AND lot_id=$3
          FOR UPDATE
          `,
          [user.tenantId, transfer.from_site_id, item.lot_id],
        );
        const sourceStock = stockResult.rows[0];
        if (!sourceStock || Number(sourceStock.quantity_available) < quantity) throw new Error('STOCK_INSUFFICIENT');

        await client.query(
          `
          UPDATE stocks
          SET quantity_available = quantity_available - $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE tenant_id=$1 AND site_id=$2 AND lot_id=$3
          `,
          [user.tenantId, transfer.from_site_id, item.lot_id, quantity],
        );

        await client.query(
          `
          INSERT INTO stocks (tenant_id, site_id, lot_id, quantity_available, quantity_reserved)
          VALUES ($1,$2,$3,$4,0)
          ON CONFLICT (site_id, lot_id) DO UPDATE
          SET quantity_available = stocks.quantity_available + EXCLUDED.quantity_available,
              updated_at = CURRENT_TIMESTAMP
          `,
          [user.tenantId, transfer.to_site_id, item.lot_id, quantity],
        );

        await client.query(
          `
          INSERT INTO stock_movements (
            tenant_id, site_id, article_id, lot_id, movement_type, quantity,
            reference_type, reference_id, notes, user_id
          )
          VALUES
            ($1,$2,$4,$5,'TRANSFER_OUT',$6,'TRANSFER',$7,$8,$9),
            ($1,$3,$4,$5,'TRANSFER_IN',$6,'TRANSFER',$7,$8,$9)
          `,
          [
            user.tenantId,
            transfer.from_site_id,
            transfer.to_site_id,
            item.article_id,
            item.lot_id,
            quantity,
            transfer.transfer_id,
            `Transfert ${transfer.transfer_number}`,
            user.userId,
          ],
        );

        await client.query(
          `
          UPDATE stock_transfer_items
          SET quantity_sent=$4, quantity_received=$4
          WHERE tenant_id=$1 AND transfer_id=$2 AND transfer_item_id=$3
          `,
          [user.tenantId, transferId, item.transfer_item_id, quantity],
        );
      }

      await client.query(
        `
        UPDATE stock_transfers
        SET status='RECEIVED', sent_by=$3, received_by=$3, sent_at=CURRENT_TIMESTAMP, received_at=CURRENT_TIMESTAMP
        WHERE tenant_id=$1 AND transfer_id=$2
        `,
        [user.tenantId, transferId, user.userId],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1,$2,'stock_transfers',$3,'VALIDATE',$4::jsonb)
        `,
        [
          user.tenantId,
          user.userId,
          transferId,
          JSON.stringify({ status: 'VALIDATED', transferNumber: transfer.transfer_number }),
        ],
      );
    });
    return this.findOne(user, transferId);
  }

  private async findItems(user: AuthUser, transferId: string) {
    const result = await this.db.query<TransferItemRow>(
      `
      SELECT ti.transfer_item_id, ti.transfer_id, ti.tenant_id, ti.article_id,
             a.article_code, a.commercial_name, ti.lot_id, l.lot_number, l.expiry_date,
             ti.quantity_requested, ti.quantity_sent, ti.quantity_received, ti.notes
      FROM stock_transfer_items ti
      JOIN articles a ON a.article_id = ti.article_id AND a.tenant_id = ti.tenant_id
      JOIN lots l ON l.lot_id = ti.lot_id AND l.tenant_id = ti.tenant_id
      WHERE ti.tenant_id=$1 AND ti.transfer_id=$2
      ORDER BY ti.transfer_item_id
      `,
      [user.tenantId, transferId],
    );
    return result.rows.map(this.toItem);
  }

  private async assertSites(user: AuthUser, fromSiteId: string, toSiteId: string) {
    if (fromSiteId === toSiteId) throw new Error('TRANSFER_SAME_SITE');
    if (user.siteId && user.siteId !== fromSiteId) throw new Error('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ total: string }>(
      `
      SELECT COUNT(*)::int AS total
      FROM sites
      WHERE tenant_id=$1 AND site_id IN ($2,$3) AND is_active=true
      `,
      [user.tenantId, fromSiteId, toSiteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 2) throw new Error('SITE_NOT_IN_TENANT');
  }

  private async assertArticleLot(user: AuthUser, articleId: string, lotId: string) {
    const result = await this.db.query<{ articles_count: string; lots_count: string }>(
      `
      SELECT
        (SELECT COUNT(*) FROM articles WHERE tenant_id=$1 AND article_id=$2 AND is_active=true)::int AS articles_count,
        (SELECT COUNT(*) FROM lots WHERE tenant_id=$1 AND lot_id=$3 AND article_id=$2)::int AS lots_count
      `,
      [user.tenantId, articleId, lotId],
    );
    if (Number(result.rows[0]?.articles_count ?? 0) !== 1) throw new Error('ARTICLE_NOT_IN_TENANT');
    if (Number(result.rows[0]?.lots_count ?? 0) !== 1) throw new Error('LOT_NOT_IN_TENANT');
  }

  private toTransfer(row: TransferRow) {
    return {
      transferId: row.transfer_id,
      tenantId: row.tenant_id,
      transferNumber: row.transfer_number,
      fromSiteId: row.from_site_id,
      fromSiteName: row.from_site_name,
      toSiteId: row.to_site_id,
      toSiteName: row.to_site_name,
      transferDate: row.transfer_date,
      status: row.status === 'RECEIVED' ? 'VALIDATED' : row.status,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      validatedAt: row.received_at ?? row.sent_at,
    };
  }

  private toItem(row: TransferItemRow) {
    return {
      transferItemId: row.transfer_item_id,
      transferId: row.transfer_id,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      lotId: row.lot_id,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date,
      quantity: Number(row.quantity_requested),
      quantitySent: row.quantity_sent === null ? null : Number(row.quantity_sent),
      quantityReceived: row.quantity_received === null ? null : Number(row.quantity_received),
      notes: row.notes,
    };
  }
}
