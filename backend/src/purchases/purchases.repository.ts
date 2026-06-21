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
  exchange_rate: string;
  total_amount: string;
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
  purchase_unit_price: string;
  selling_unit_price: string;
  line_total: string;
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
             sup.supplier_name, p.site_id, s.site_name, p.currency_id, p.exchange_rate,
             p.total_amount, p.status, p.created_by, p.created_at, p.validated_at
      FROM purchases p
      JOIN suppliers sup ON sup.supplier_id = p.supplier_id AND sup.tenant_id = p.tenant_id
      JOIN sites s ON s.site_id = p.site_id AND s.tenant_id = p.tenant_id
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
             sup.supplier_name, p.site_id, s.site_name, p.currency_id, p.exchange_rate,
             p.total_amount, p.status, p.created_by, p.created_at, p.validated_at
      FROM purchases p
      JOIN suppliers sup ON sup.supplier_id = p.supplier_id AND sup.tenant_id = p.tenant_id
      JOIN sites s ON s.site_id = p.site_id AND s.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1 AND p.purchase_id = $2
        AND ($3::uuid IS NULL OR p.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, id, user.siteId ?? null],
    );
    if (!purchase.rows[0]) return null;
    const items = await this.findItems(user, id);
    return { ...this.toPurchase(purchase.rows[0]), items };
  }

  async create(user: AuthUser, dto: CreatePurchaseDto) {
    await this.assertTenantRelations(user, dto.supplierId, dto.siteId, dto.currencyId);
    const number = `PUR-${Date.now()}`;
    const result = await this.db.query<PurchaseRow>(
      `
      INSERT INTO purchases (
        tenant_id, purchase_number, purchase_date, supplier_id, site_id, currency_id,
        exchange_rate, created_by
      )
      VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7,$8)
      RETURNING purchase_id, tenant_id, purchase_number, purchase_date, supplier_id,
                NULL::text AS supplier_name, site_id, NULL::text AS site_name, currency_id,
                exchange_rate, total_amount, status, created_by, created_at, validated_at
      `,
      [
        user.tenantId,
        number,
        dto.purchaseDate ?? null,
        dto.supplierId,
        dto.siteId,
        dto.currencyId ?? null,
        dto.exchangeRate ?? 1,
        user.userId,
      ],
    );
    return this.findOne(user, result.rows[0].purchase_id);
  }

  async update(user: AuthUser, id: string, dto: UpdatePurchaseDto) {
    const current = await this.findOne(user, id);
    if (!current) return null;
    if (current.status !== 'DRAFT') throw new Error('PURCHASE_NOT_DRAFT');
    const supplierId = dto.supplierId ?? current.supplierId;
    const siteId = dto.siteId ?? current.siteId;
    const currencyId = dto.currencyId ?? current.currencyId ?? undefined;
    await this.assertTenantRelations(user, supplierId, siteId, currencyId);
    await this.db.query(
      `
      UPDATE purchases
      SET purchase_date=COALESCE($3::date, purchase_date), supplier_id=$4, site_id=$5,
          currency_id=$6, exchange_rate=$7
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
      ],
    );
    return this.findOne(user, id);
  }

  async addItem(user: AuthUser, purchaseId: string, dto: AddPurchaseItemDto) {
    const purchase = await this.findOne(user, purchaseId);
    if (!purchase) return null;
    if (purchase.status !== 'DRAFT') throw new Error('PURCHASE_NOT_DRAFT');
    await this.assertArticle(user, dto.articleId);
    const lineTotal = dto.quantity * dto.purchaseUnitPrice;
    await this.db.query(
      `
      INSERT INTO purchase_items (
        tenant_id, purchase_id, article_id, lot_number, expiry_date, quantity,
        purchase_unit_price, selling_unit_price, line_total
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        user.tenantId,
        purchaseId,
        dto.articleId,
        dto.lotNumber.trim(),
        dto.expiryDate,
        dto.quantity,
        dto.purchaseUnitPrice,
        dto.sellingUnitPrice,
        lineTotal,
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
               p.exchange_rate, p.total_amount, p.status, p.created_by, p.created_at, p.validated_at
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
               pi.expiry_date, pi.quantity, pi.purchase_unit_price, pi.selling_unit_price, pi.line_total
        FROM purchase_items pi
        JOIN articles a ON a.article_id = pi.article_id AND a.tenant_id = pi.tenant_id
        WHERE pi.tenant_id=$1 AND pi.purchase_id=$2
        `,
        [user.tenantId, purchaseId],
      );
      if (!itemResult.rows.length) throw new Error('PURCHASE_HAS_NO_ITEMS');

      for (const item of itemResult.rows) {
        const quantity = Number(item.quantity);
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
             pi.quantity, pi.purchase_unit_price, pi.selling_unit_price, pi.line_total
      FROM purchase_items pi
      JOIN articles a ON a.article_id = pi.article_id AND a.tenant_id = pi.tenant_id
      WHERE pi.tenant_id=$1 AND pi.purchase_id=$2
      ORDER BY pi.purchase_item_id
      `,
      [user.tenantId, purchaseId],
    );
    return result.rows.map(this.toItem);
  }

  private async recalculateTotal(user: AuthUser, purchaseId: string) {
    await this.db.query(
      `
      UPDATE purchases
      SET total_amount = COALESCE((SELECT SUM(line_total) FROM purchase_items WHERE tenant_id=$1 AND purchase_id=$2), 0)
      WHERE tenant_id=$1 AND purchase_id=$2
      `,
      [user.tenantId, purchaseId],
    );
  }

  private async assertTenantRelations(user: AuthUser, supplierId: string, siteId: string, currencyId?: string) {
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
  }

  private async assertArticle(user: AuthUser, articleId: string) {
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM articles WHERE tenant_id=$1 AND article_id=$2 AND is_active=true`,
      [user.tenantId, articleId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('ARTICLE_NOT_IN_TENANT');
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
      exchangeRate: Number(row.exchange_rate),
      totalAmount: Number(row.total_amount),
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
      purchaseUnitPrice: Number(row.purchase_unit_price),
      sellingUnitPrice: Number(row.selling_unit_price),
      lineTotal: Number(row.line_total),
    };
  }
}
