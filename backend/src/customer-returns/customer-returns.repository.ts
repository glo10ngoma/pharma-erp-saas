import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { AddCustomerReturnItemDto } from './dto/add-customer-return-item.dto';
import { CreateCustomerReturnDto } from './dto/create-customer-return.dto';
import { InspectCustomerReturnDto } from './dto/inspect-customer-return.dto';
import { ListCustomerReturnsDto } from './dto/list-customer-returns.dto';

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
  created_at: Date;
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
      items: await this.findItems(user, id),
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
      await this.insertAudit(client, user, inserted.rows[0].customer_return_id, 'INSERT', { saleId: sale.saleId, returnNumber });
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

      const inserted = await client.query(
        `
        INSERT INTO customer_return_items (
          tenant_id, customer_return_id, sale_id, sale_item_id, article_id, lot_id,
          article_code_snapshot, commercial_name_snapshot, lot_number_snapshot, expiry_date_snapshot,
          sale_quantity, returned_quantity, condition_status, note
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING customer_return_item_id
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
        ],
      );
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', { action: 'ADD_ITEM', saleItemId: dto.saleItemId, returnedQuantity: dto.returnedQuantity });
      return inserted.rows[0].customer_return_item_id;
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
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', { action: 'REMOVE_ITEM', customerReturnItemId: itemId });
      return { deleted: true };
    });
  }

  async submitForInspection(user: AuthUser, customerReturnId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'DRAFT') throw new Error('CUSTOMER_RETURN_NOT_DRAFT');
      const items = await this.findItems(client, customerReturnId, user.tenantId);
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
      await this.insertAudit(client, user, customerReturnId, 'UPDATE', { action: 'INSPECT', decision: nextStatus, note: dto.note ?? null });
      return { inspected: true, status: nextStatus };
    });
  }

  async validate(user: AuthUser, customerReturnId: string) {
    return this.db.transaction(async (client) => {
      const current = await this.findHeader(client, user.tenantId, customerReturnId, user.siteId ?? null);
      if (!current) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'APPROVED') throw new Error('CUSTOMER_RETURN_NOT_APPROVED');

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
      await this.insertAudit(client, user, customerReturnId, 'VALIDATE', { action: 'VALIDATE' });
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

  private async findItems(user: AuthUser | { query: DatabaseService['query'] }, customerReturnId: string, tenantId?: string) {
    const result = await this.db.query<CustomerReturnItemRow>(
      `
      SELECT
        cri.customer_return_item_id, cri.customer_return_id, cri.sale_id, cri.sale_item_id, cri.article_id,
        cri.article_code_snapshot, cri.commercial_name_snapshot, cri.lot_id, cri.lot_number_snapshot,
        cri.expiry_date_snapshot, cri.sale_quantity, cri.returned_quantity, cri.condition_status,
        cri.note, cri.created_at
      FROM customer_return_items cri
      WHERE cri.tenant_id = $1
        AND cri.customer_return_id = $2::uuid
      ORDER BY cri.created_at ASC, cri.customer_return_item_id ASC
      `,
      [tenantId ?? (user as AuthUser).tenantId, customerReturnId],
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
      createdAt: row.created_at,
    }));
  }

  private async findHeader(client: { query: DatabaseService['query'] }, tenantId: string, customerReturnId: string, siteId: string | null) {
    const result = await client.query<CustomerReturnRow>(
      `
      SELECT
        cr.customer_return_id, cr.tenant_id, cr.site_id, s.site_name, cr.sale_id,
        cr.sale_number_snapshot, cr.sale_date_snapshot, cr.sale_type_snapshot,
        cr.customer_id, cr.customer_name_snapshot, cr.organization_id, cr.organization_name_snapshot,
        cr.membership_id, cr.site_name_snapshot, cr.currency_code, cr.exchange_rate_snapshot,
        cr.return_number, cr.return_date, cr.status, cr.reason, cr.note, cr.inspection_note,
        cr.created_by, cr.inspected_by, cr.validated_by, cr.created_at, cr.inspected_at,
        cr.validated_at, cr.cancelled_at
      FROM customer_returns cr
      LEFT JOIN sites s ON s.site_id = cr.site_id AND s.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = $1
        AND cr.customer_return_id = $2::uuid
        AND ($3::uuid IS NULL OR cr.site_id = $3::uuid)
      LIMIT 1
      `,
      [tenantId, customerReturnId, siteId],
    );
    return result.rows[0] ?? null;
  }

  private async nextReturnNumber(client: { query: DatabaseService['query'] }, tenantId: string) {
    const result = await client.query<{ return_number: string }>(
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

  private async insertAudit(client: { query: DatabaseService['query'] }, user: AuthUser, recordId: string, actionType: string, payload: unknown) {
    await client.query(
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

  private toCivilDate(value: string | Date | null | undefined) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
