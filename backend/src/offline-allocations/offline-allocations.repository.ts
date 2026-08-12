import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateOfflineAllocationDto } from './dto/create-offline-allocation.dto';
import { ListOfflineAllocationsDto } from './dto/list-offline-allocations.dto';
import { RebalanceOfflineAllocationsDto } from './dto/rebalance-offline-allocations.dto';
import { TransferOfflineAllocationDto } from './dto/transfer-offline-allocation.dto';
import { UpdateOfflineAllocationDto } from './dto/update-offline-allocation.dto';

type OfflineAllocationRow = {
  allocation_id: string;
  tenant_id: string;
  site_id: string;
  site_name: string | null;
  workstation_id: string;
  workstation_name: string | null;
  article_id: string;
  article_code: string | null;
  article_name: string | null;
  lot_id: string;
  lot_number: string | null;
  expiry_date: Date | string | null;
  is_blocked: boolean | null;
  block_reason: string | null;
  allocated_quantity: string;
  consumed_quantity: string;
  status: string;
  server_version: string;
  updated_at: Date | null;
};

type FreeStockRow = {
  quantity_available: string;
  reserved_quantity: string;
};

@Injectable()
export class OfflineAllocationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(user: AuthUser, query: ListOfflineAllocationsDto) {
    this.assertReadPermission(user);
    const siteId = query.siteId ?? user.siteId ?? null;
    if (siteId) await this.assertSiteAllowed(user, siteId);

    const result = await this.db.query<OfflineAllocationRow>(
      `
      SELECT
        osa.allocation_id,
        osa.tenant_id,
        osa.site_id,
        s.site_name,
        osa.workstation_id,
        w.workstation_name,
        osa.article_id,
        a.article_code,
        a.commercial_name AS article_name,
        osa.lot_id,
        l.lot_number,
        l.expiry_date,
        l.is_blocked,
        l.block_reason,
        osa.allocated_quantity,
        osa.consumed_quantity,
        osa.status,
        osa.server_version,
        osa.updated_at
      FROM offline_stock_allocations osa
      JOIN sites s
        ON s.site_id = osa.site_id
       AND s.tenant_id = osa.tenant_id
      JOIN pos_workstations w
        ON w.workstation_id = osa.workstation_id
       AND w.tenant_id = osa.tenant_id
      JOIN articles a
        ON a.article_id = osa.article_id
       AND a.tenant_id = osa.tenant_id
      JOIN lots l
        ON l.lot_id = osa.lot_id
      WHERE osa.tenant_id = $1
        AND ($2::uuid IS NULL OR osa.site_id = $2::uuid)
        AND ($3::uuid IS NULL OR osa.workstation_id = $3::uuid)
        AND ($4::uuid IS NULL OR osa.article_id = $4::uuid)
        AND ($5::uuid IS NULL OR osa.lot_id = $5::uuid)
        AND ($6::varchar IS NULL OR osa.status = $6::varchar)
        AND (
          $7::varchar IS NULL
          OR COALESCE(w.workstation_name, '') ILIKE '%' || $7 || '%'
          OR COALESCE(s.site_name, '') ILIKE '%' || $7 || '%'
          OR COALESCE(a.article_code, '') ILIKE '%' || $7 || '%'
          OR COALESCE(a.commercial_name, '') ILIKE '%' || $7 || '%'
          OR COALESCE(l.lot_number, '') ILIKE '%' || $7 || '%'
        )
      ORDER BY a.commercial_name ASC, l.expiry_date ASC NULLS LAST, w.workstation_name ASC
      `,
      [
        user.tenantId,
        siteId,
        query.workstationId ?? null,
        query.articleId ?? null,
        query.lotId ?? null,
        query.status ?? null,
        query.search?.trim() || null,
      ],
    );

    return result.rows.map((row) => this.toAllocation(row));
  }

  async findOne(user: AuthUser, id: string) {
    const rows = await this.list(user, {});
    const item = rows.find((row) => row.allocationId === id);
    if (!item) throw new NotFoundException('OFFLINE_ALLOCATION_NOT_FOUND');
    return item;
  }

  async create(user: AuthUser, dto: CreateOfflineAllocationDto) {
    this.assertManagePermission(user);
    await this.assertSiteAllowed(user, dto.siteId);

    const allocationId = await this.db.transaction(async (client) => {
      await this.assertWorkstationAllowed(client, user, dto.workstationId, dto.siteId);
      const lot = await this.getLotForAllocation(client, user, dto.lotId, dto.articleId);
      if (lot.isBlocked) throw new BadRequestException('LOT_BLOCKED');
      if (lot.isExpired) throw new BadRequestException('LOT_EXPIRED');

      const free = await this.getFreeOnlineQuantity(client, user, dto.siteId, dto.articleId, dto.lotId);
      if (dto.quantity > free) throw new BadRequestException('OFFLINE_ALLOCATION_INSUFFICIENT');

      const inserted = await client.query<{ allocation_id: string }>(
        `
        INSERT INTO offline_stock_allocations (
          tenant_id, site_id, workstation_id, article_id, lot_id,
          allocated_quantity, consumed_quantity, status, server_version, allocated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE', 1, $7)
        ON CONFLICT (tenant_id, workstation_id, lot_id) DO UPDATE SET
          allocated_quantity = offline_stock_allocations.allocated_quantity + EXCLUDED.allocated_quantity,
          status = CASE
            WHEN offline_stock_allocations.status = 'REVOKED' THEN 'ACTIVE'
            ELSE offline_stock_allocations.status
          END,
          server_version = offline_stock_allocations.server_version + 1,
          updated_at = CURRENT_TIMESTAMP,
          allocated_by = EXCLUDED.allocated_by
        RETURNING allocation_id
        `,
        [user.tenantId, dto.siteId, dto.workstationId, dto.articleId, dto.lotId, dto.quantity, user.userId],
      );

      await this.insertAudit(client, user, inserted.rows[0].allocation_id, 'INSERT', {
        action: 'OFFLINE_ALLOCATION_CREATE',
        quantity: dto.quantity,
        workstationId: dto.workstationId,
        articleId: dto.articleId,
        lotId: dto.lotId,
      });

      return inserted.rows[0].allocation_id;
    });

    return this.findOne(user, allocationId);
  }

  async update(user: AuthUser, id: string, dto: UpdateOfflineAllocationDto) {
    this.assertManagePermission(user);
    const current = await this.findOne(user, id);

    return this.db.transaction(async (client) => {
      if (dto.allocatedQuantity !== undefined && dto.allocatedQuantity < current.consumedQuantity) {
        throw new BadRequestException('OFFLINE_ALLOCATION_BELOW_CONSUMED');
      }

      await client.query(
        `
        UPDATE offline_stock_allocations
        SET allocated_quantity = COALESCE($3, allocated_quantity),
            status = COALESCE($4, status),
            server_version = server_version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND allocation_id = $2
        `,
        [user.tenantId, id, dto.allocatedQuantity ?? null, dto.status ?? null],
      );

      await this.insertAudit(client, user, id, 'UPDATE', {
        action: 'OFFLINE_ALLOCATION_UPDATE',
        allocatedQuantity: dto.allocatedQuantity ?? null,
        status: dto.status ?? null,
      });
    });

    return this.findOne(user, id);
  }

  async suspend(user: AuthUser, id: string) {
    this.assertManagePermission(user);
    await this.setStatus(user, id, 'SUSPENDED', 'OFFLINE_ALLOCATION_SUSPEND');
    return this.findOne(user, id);
  }

  async revoke(user: AuthUser, id: string) {
    this.assertManagePermission(user);
    const current = await this.findOne(user, id);
    if (current.remainingQuantity <= 0) {
      await this.setStatus(user, id, 'REVOKED', 'OFFLINE_ALLOCATION_REVOKE');
      return this.findOne(user, id);
    }

    await this.db.transaction(async (client) => {
      await client.query(
        `
        UPDATE offline_stock_allocations
        SET allocated_quantity = consumed_quantity,
            status = 'REVOKED',
            server_version = server_version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND allocation_id = $2
        `,
        [user.tenantId, id],
      );

      await this.insertAudit(client, user, id, 'UPDATE', {
        action: 'OFFLINE_ALLOCATION_REVOKE',
        releasedQuantity: current.remainingQuantity,
      });
    });

    return this.findOne(user, id);
  }

  async release(user: AuthUser, id: string) {
    this.assertManagePermission(user);
    const current = await this.findOne(user, id);
    if (current.remainingQuantity <= 0) return current;

    await this.db.transaction(async (client) => {
      await client.query(
        `
        UPDATE offline_stock_allocations
        SET allocated_quantity = consumed_quantity,
            status = CASE WHEN consumed_quantity <= 0 THEN 'REVOKED' ELSE 'EXHAUSTED' END,
            server_version = server_version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND allocation_id = $2
        `,
        [user.tenantId, id],
      );

      await this.insertAudit(client, user, id, 'UPDATE', {
        action: 'OFFLINE_ALLOCATION_RELEASE',
        releasedQuantity: current.remainingQuantity,
      });
    });

    return this.findOne(user, id);
  }

  async transfer(user: AuthUser, dto: TransferOfflineAllocationDto) {
    this.assertTransferPermission(user);
    const source = await this.findOne(user, dto.allocationId);
    if (source.workstationId !== dto.sourceWorkstationId) throw new BadRequestException('OFFLINE_ALLOCATION_SOURCE_MISMATCH');
    if (dto.sourceWorkstationId === dto.targetWorkstationId) throw new BadRequestException('OFFLINE_ALLOCATION_TRANSFER_SELF');
    if (dto.quantity > source.remainingQuantity) throw new BadRequestException('OFFLINE_ALLOCATION_INSUFFICIENT');

    await this.db.transaction(async (client) => {
      await this.assertWorkstationAllowed(client, user, dto.sourceWorkstationId, source.siteId);
      await this.assertWorkstationAllowed(client, user, dto.targetWorkstationId, source.siteId);

      await client.query(
        `
        UPDATE offline_stock_allocations
        SET allocated_quantity = allocated_quantity - $3,
            status = CASE
              WHEN allocated_quantity - $3 <= consumed_quantity THEN 'EXHAUSTED'
              ELSE status
            END,
            server_version = server_version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND allocation_id = $2
        `,
        [user.tenantId, dto.allocationId, dto.quantity],
      );

      await client.query(
        `
        INSERT INTO offline_stock_allocations (
          tenant_id, site_id, workstation_id, article_id, lot_id,
          allocated_quantity, consumed_quantity, status, server_version, allocated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE', 1, $7)
        ON CONFLICT (tenant_id, workstation_id, lot_id) DO UPDATE SET
          allocated_quantity = offline_stock_allocations.allocated_quantity + EXCLUDED.allocated_quantity,
          status = 'ACTIVE',
          server_version = offline_stock_allocations.server_version + 1,
          updated_at = CURRENT_TIMESTAMP,
          allocated_by = EXCLUDED.allocated_by
        `,
        [user.tenantId, source.siteId, dto.targetWorkstationId, source.articleId, source.lotId, dto.quantity, user.userId],
      );

      await this.insertAudit(client, user, dto.allocationId, 'UPDATE', {
        action: 'OFFLINE_ALLOCATION_TRANSFER',
        sourceWorkstationId: dto.sourceWorkstationId,
        targetWorkstationId: dto.targetWorkstationId,
        quantity: dto.quantity,
      });
    });

    return {
      source: await this.findOne(user, dto.allocationId),
      target: (await this.list(user, { workstationId: dto.targetWorkstationId, lotId: source.lotId })).find(
        (row) => row.workstationId === dto.targetWorkstationId && row.lotId === source.lotId,
      ) ?? null,
    };
  }

  async rebalance(user: AuthUser, dto: RebalanceOfflineAllocationsDto) {
    this.assertRebalancePermission(user);
    await this.assertSiteAllowed(user, dto.siteId);
    const quantityToAllocate = dto.quantityToAllocate ?? await this.getFreeOnlineQuantity(this.db, user, dto.siteId, dto.articleId, dto.lotId);
    if (quantityToAllocate <= 0) throw new BadRequestException('OFFLINE_ALLOCATION_NOTHING_TO_ALLOCATE');

    const plan = buildEqualRebalancePlan(quantityToAllocate, dto.workstationIds);
    await this.db.transaction(async (client) => {
      for (const workstationId of dto.workstationIds) {
        await this.assertWorkstationAllowed(client, user, workstationId, dto.siteId);
      }

      for (const item of plan) {
        await client.query(
          `
          INSERT INTO offline_stock_allocations (
            tenant_id, site_id, workstation_id, article_id, lot_id,
            allocated_quantity, consumed_quantity, status, server_version, allocated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE', 1, $7)
          ON CONFLICT (tenant_id, workstation_id, lot_id) DO UPDATE SET
            allocated_quantity = offline_stock_allocations.allocated_quantity + EXCLUDED.allocated_quantity,
            status = 'ACTIVE',
            server_version = offline_stock_allocations.server_version + 1,
            updated_at = CURRENT_TIMESTAMP,
            allocated_by = EXCLUDED.allocated_by
          `,
          [user.tenantId, dto.siteId, item.workstationId, dto.articleId, dto.lotId, item.quantity, user.userId],
        );
      }

      await this.insertAudit(client, user, dto.lotId, 'UPDATE', {
        action: 'OFFLINE_ALLOCATION_REBALANCE',
        mode: dto.mode,
        siteId: dto.siteId,
        articleId: dto.articleId,
        lotId: dto.lotId,
        quantityToAllocate,
        plan,
      });
    });

    return this.list(user, {
      siteId: dto.siteId,
      articleId: dto.articleId,
      lotId: dto.lotId,
    });
  }

  private async setStatus(user: AuthUser, id: string, status: 'SUSPENDED' | 'REVOKED', action: string) {
    await this.db.transaction(async (client) => {
      await client.query(
        `
        UPDATE offline_stock_allocations
        SET status = $3,
            server_version = server_version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND allocation_id = $2
        `,
        [user.tenantId, id, status],
      );
      await this.insertAudit(client, user, id, 'UPDATE', { action, status });
    });
  }

  private async getLotForAllocation(
    client: Pick<DatabaseService, 'query'> | { query: DatabaseService['query'] },
    user: AuthUser,
    lotId: string,
    articleId: string,
  ) {
    const result = await client.query<{
      lot_id: string;
      article_id: string;
      is_blocked: boolean;
      expiry_date: Date | string | null;
    }>(
      `
      SELECT lot_id, article_id, is_blocked, expiry_date
      FROM lots
      WHERE lot_id = $1
        AND article_id = $2
      LIMIT 1
      `,
      [lotId, articleId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('LOT_NOT_FOUND');
    const expiryDate = row.expiry_date ? new Date(String(row.expiry_date)) : null;
    return {
      isBlocked: Boolean(row.is_blocked),
      isExpired: expiryDate ? expiryDate.getTime() < Date.now() - 24 * 60 * 60 * 1000 : false,
    };
  }

  private async getFreeOnlineQuantity(
    client: Pick<DatabaseService, 'query'> | { query: DatabaseService['query'] },
    user: AuthUser,
    siteId: string,
    articleId: string,
    lotId: string,
  ) {
    const result = await client.query<FreeStockRow>(
      `
      SELECT
        COALESCE(st.quantity_available, 0)::numeric AS quantity_available,
        COALESCE((
          SELECT SUM(GREATEST(allocated_quantity - consumed_quantity, 0))
          FROM offline_stock_allocations
          WHERE tenant_id = $1
            AND site_id = $2
            AND article_id = $3
            AND lot_id = $4
            AND status IN ('ACTIVE', 'SUSPENDED', 'EXHAUSTED')
        ), 0)::numeric AS reserved_quantity
      FROM stocks st
      JOIN lots l
        ON l.lot_id = st.lot_id
       AND l.tenant_id = st.tenant_id
      WHERE st.tenant_id = $1
        AND st.site_id = $2
        AND l.article_id = $3
        AND st.lot_id = $4
      LIMIT 1
      `,
      [user.tenantId, siteId, articleId, lotId],
    );
    const row = result.rows[0];
    const available = Number(row?.quantity_available ?? 0);
    const reserved = Number(row?.reserved_quantity ?? 0);
    return Math.max(0, available - reserved);
  }

  private async assertWorkstationAllowed(
    client: Pick<DatabaseService, 'query'> | { query: DatabaseService['query'] },
    user: AuthUser,
    workstationId: string,
    siteId: string,
  ) {
    const result = await client.query<{ total: string }>(
      `
      SELECT COUNT(*)::int AS total
      FROM pos_workstations
      WHERE tenant_id = $1
        AND workstation_id = $2
        AND site_id = $3
        AND is_active = true
        AND offline_status <> 'REVOKED'
      `,
      [user.tenantId, workstationId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) {
      throw new BadRequestException('WORKSTATION_NOT_IN_SITE');
    }
  }

  private async assertSiteAllowed(user: AuthUser, siteId: string) {
    if (user.siteId && user.siteId !== siteId) throw new BadRequestException('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM sites WHERE tenant_id = $1 AND site_id = $2 AND is_active = true`,
      [user.tenantId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new BadRequestException('SITE_NOT_IN_TENANT');
  }

  private assertReadPermission(user: AuthUser) {
    if (!user.permissions.includes('offline_allocations.read') && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private assertManagePermission(user: AuthUser) {
    if (!user.permissions.includes('offline_allocations.manage') && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private assertTransferPermission(user: AuthUser) {
    if (!user.permissions.includes('offline_allocations.transfer') && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private assertRebalancePermission(user: AuthUser) {
    if (!user.permissions.includes('offline_allocations.rebalance') && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private async insertAudit(
    client: Pick<DatabaseService, 'query'> | { query: DatabaseService['query'] },
    user: AuthUser,
    recordId: string,
    actionType: 'INSERT' | 'UPDATE',
    payload: unknown,
  ) {
    await client.query(
      `
      INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
      VALUES ($1, $2, $3, 'offline_stock_allocations', $4, $5, $6::jsonb)
      `,
      [user.tenantId, user.siteId ?? null, user.userId, recordId, actionType, JSON.stringify(payload)],
    );
  }

  private toAllocation(row: OfflineAllocationRow) {
    const allocatedQuantity = Number(row.allocated_quantity ?? 0);
    const consumedQuantity = Number(row.consumed_quantity ?? 0);
    return {
      allocationId: row.allocation_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      workstationId: row.workstation_id,
      workstationName: row.workstation_name,
      articleId: row.article_id,
      articleCode: row.article_code,
      articleName: row.article_name,
      lotId: row.lot_id,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : null,
      isBlocked: Boolean(row.is_blocked),
      blockReason: row.block_reason,
      allocatedQuantity,
      consumedQuantity,
      remainingQuantity: Math.max(0, allocatedQuantity - consumedQuantity),
      status: row.status,
      serverVersion: Number(row.server_version ?? 0),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    };
  }
}

function buildEqualRebalancePlan(quantity: number, workstationIds: string[]) {
  const total = Math.floor(quantity * 1000) / 1000;
  const base = Math.floor((total / workstationIds.length) * 1000) / 1000;
  let remainder = Math.round((total - base * workstationIds.length) * 1000);

  return workstationIds.map((workstationId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - extra);
    return {
      workstationId,
      quantity: base + extra / 1000,
    };
  });
}
