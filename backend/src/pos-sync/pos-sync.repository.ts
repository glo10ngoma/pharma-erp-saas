import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { BootstrapPosDto } from './dto/bootstrap-pos.dto';
import { ListPosChangesDto } from './dto/list-pos-changes.dto';
import { RegisterPosWorkstationDto } from './dto/register-pos-workstation.dto';

type WorkstationRow = {
  workstation_id: string;
  tenant_id: string;
  site_id: string | null;
  site_code: string | null;
  site_name: string | null;
  workstation_code: string;
  workstation_name: string;
  workstation_type: string;
  is_active: boolean;
  device_uuid: string | null;
  offline_status: string;
  sync_state: string;
  updated_at: Date | null;
};

type ExchangeRateRow = {
  setting_value: string;
  updated_at: Date | null;
};

type OfflineSettingsRow = {
  default_currency: string;
  supported_currencies: string[];
  offline_hours: string | null;
  timezone: string | null;
};

type ArticleBootstrapRow = {
  article_id: string;
  article_code: string;
  commercial_name: string;
  barcode: string | null;
  is_active: boolean;
  sales_unit: string | null;
  packaging: string | null;
  packaging_quantity: string | null;
  default_selling_price: string | null;
  updated_at: Date | null;
};

type LotBootstrapRow = {
  lot_id: string;
  article_id: string;
  lot_number: string;
  expiry_date: Date | string;
  is_blocked: boolean;
  block_reason: string | null;
  selling_price: string | null;
  changed_at: Date | null;
};

type AllocationBootstrapRow = {
  allocation_id: string;
  workstation_id: string;
  site_id: string;
  article_id: string;
  lot_id: string;
  allocated_quantity: string;
  consumed_quantity: string;
  status: string;
  server_version: string;
  updated_at: Date | null;
};

type CustomerBootstrapRow = {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: Date | null;
};

type TenantRow = {
  tenant_id: string;
  tenant_code: string;
  tenant_name: string;
};

type SiteRow = {
  site_id: string;
  site_code: string;
  site_name: string;
};

type TimestampedArticleChange = ArticleBootstrapRow & { operation: 'UPSERT' | 'DEACTIVATE'; changed_at: Date | null };
type TimestampedLotChange = LotBootstrapRow & { operation: 'UPSERT' | 'REVOKE'; changed_at: Date | null };
type TimestampedAllocationChange = AllocationBootstrapRow & { operation: 'UPSERT' | 'REVOKE'; changed_at: Date | null };
type TimestampedCustomerChange = CustomerBootstrapRow & { operation: 'UPSERT' | 'DEACTIVATE'; changed_at: Date | null };
type TimestampedSettingsChange = { operation: 'UPSERT'; changed_at: Date | null; rate: string | null; updated_at: Date | null };

const DEFAULT_OFFLINE_AUTHORIZATION_HOURS = 24;
const DEFAULT_TIMEZONE = 'Africa/Kinshasa';
const DEFAULT_ALLOCATION_POLICY = 'STRICT_PER_WORKSTATION_LOT';

@Injectable()
export class PosSyncRepository {
  constructor(private readonly db: DatabaseService) {}

  async registerWorkstation(user: AuthUser, dto: RegisterPosWorkstationDto) {
    await this.assertSiteAllowed(user, dto.siteId);

    const existing = await this.db.query<WorkstationRow>(
      `
      SELECT w.workstation_id, w.tenant_id, w.site_id, s.site_code, s.site_name, w.workstation_code, w.workstation_name,
             w.workstation_type, w.is_active, w.device_uuid, w.offline_status, w.sync_state, w.updated_at
      FROM pos_workstations w
      LEFT JOIN sites s ON s.site_id = w.site_id AND s.tenant_id = w.tenant_id
      WHERE w.tenant_id = $1
        AND w.device_uuid = $2
      LIMIT 1
      `,
      [user.tenantId, dto.deviceId],
    );

    if (existing.rows[0]) {
      await this.db.query(
        `
        UPDATE pos_workstations
        SET site_id = $3,
            workstation_name = $4,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND workstation_id = $2
        `,
        [user.tenantId, existing.rows[0].workstation_id, dto.siteId, dto.workstationName.trim()],
      );
      await this.insertAudit(user, existing.rows[0].workstation_id, 'UPDATE', {
        action: 'POS_SYNC_REGISTER',
        deviceId: dto.deviceId,
        workstationName: dto.workstationName,
        appVersion: dto.appVersion ?? null,
      });
      return this.resolveWorkstation(user, { workstationId: existing.rows[0].workstation_id, deviceId: dto.deviceId });
    }

    const workstationCode = `POS-${dto.deviceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const inserted = await this.db.query<{ workstation_id: string }>(
      `
      INSERT INTO pos_workstations (
        tenant_id, site_id, workstation_code, workstation_name, workstation_type, device_uuid, offline_status, sync_state
      )
      VALUES ($1, $2, $3, $4, 'POS', $5, 'OFFLINE_READY', 'SYNCED')
      RETURNING workstation_id
      `,
      [user.tenantId, dto.siteId, workstationCode, dto.workstationName.trim(), dto.deviceId],
    );

    await this.insertAudit(user, inserted.rows[0].workstation_id, 'INSERT', {
      action: 'POS_SYNC_REGISTER',
      deviceId: dto.deviceId,
      workstationCode,
      workstationName: dto.workstationName,
      appVersion: dto.appVersion ?? null,
    });

    return this.resolveWorkstation(user, { workstationId: inserted.rows[0].workstation_id, deviceId: dto.deviceId });
  }

  async buildBootstrap(user: AuthUser, query: BootstrapPosDto) {
    this.assertOfflinePermissions(user);
    const workstation = await this.resolveWorkstation(user, query);
    const [tenant, site, exchangeRate, settings, articles, lots, allocations, customers] = await Promise.all([
      this.getTenant(user),
      this.getSite(user, workstation.siteId),
      this.getExchangeRate(user),
      this.getOfflineSettings(user),
      this.getBootstrapArticles(user, workstation),
      this.getBootstrapLots(user, workstation),
      this.getBootstrapAllocations(user, workstation),
      this.getBootstrapCustomers(user),
    ]);

    const serverTime = new Date().toISOString();
    const syncCursor = encodeCursor(serverTime);
    return {
      serverTime,
      syncCursor,
      bootstrapVersion: 'offline-1',
      tenant,
      site,
      workstation: {
        workstationId: workstation.workstationId,
        workstationName: workstation.workstationName,
        deviceId: workstation.deviceUuid,
        status: workstation.offlineStatus,
      },
      user: {
        userId: user.userId,
        displayName: user.fullName,
        role: user.role,
      },
      permissions: user.permissions,
      settings: {
        currency: settings.defaultCurrency,
        exchangeRate,
        offlineAuthorizationHours: settings.offlineAuthorizationHours,
        allocationPolicy: DEFAULT_ALLOCATION_POLICY,
        timezone: settings.timezone,
        supportedCurrencies: settings.supportedCurrencies,
      },
      articles,
      lots,
      offlineAllocations: allocations,
      customers,
    };
  }

  async listChanges(user: AuthUser, query: ListPosChangesDto) {
    this.assertOfflinePermissions(user);
    const workstation = await this.resolveWorkstation(user, query);
    const since = decodeCursor(query.cursor);
    const [articles, lots, allocations, customers, settings] = await Promise.all([
      this.getArticleChanges(user, workstation, since),
      this.getLotChanges(user, workstation, since),
      this.getAllocationChanges(user, workstation, since),
      this.getCustomerChanges(user, since),
      this.getSettingsChanges(user, since),
    ]);
    const serverTime = new Date().toISOString();
    return {
      serverTime,
      previousCursor: query.cursor ?? null,
      nextCursor: encodeCursor(serverTime),
      hasMore: false,
      changes: { articles, lots, allocations, customers, settings },
    };
  }

  private assertOfflinePermissions(user: AuthUser) {
    if (!user.permissions.includes('offline_allocations.read') && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private async resolveWorkstation(user: AuthUser, query: { workstationId?: string; deviceId?: string }) {
    if (!query.workstationId && !query.deviceId) {
      throw new BadRequestException('WORKSTATION_IDENTIFIER_REQUIRED');
    }
    const result = await this.db.query<WorkstationRow>(
      `
      SELECT w.workstation_id, w.tenant_id, w.site_id, s.site_code, s.site_name, w.workstation_code, w.workstation_name,
             w.workstation_type, w.is_active, w.device_uuid, w.offline_status, w.sync_state, w.updated_at
      FROM pos_workstations w
      LEFT JOIN sites s ON s.site_id = w.site_id AND s.tenant_id = w.tenant_id
      WHERE w.tenant_id = $1
        AND ($2::uuid IS NULL OR w.workstation_id = $2::uuid)
        AND ($3::varchar IS NULL OR w.device_uuid = $3::varchar)
        AND ($4::uuid IS NULL OR w.site_id = $4::uuid)
      ORDER BY w.updated_at DESC NULLS LAST, w.created_at DESC NULLS LAST
      LIMIT 1
      `,
      [user.tenantId, query.workstationId ?? null, query.deviceId ?? null, user.siteId ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('WORKSTATION_NOT_FOUND');
    if (!row.is_active) throw new BadRequestException('WORKSTATION_INACTIVE');
    if (!row.site_id) throw new BadRequestException('WORKSTATION_SITE_REQUIRED');
    return {
      workstationId: row.workstation_id,
      siteId: row.site_id,
      siteCode: row.site_code,
      siteName: row.site_name,
      workstationCode: row.workstation_code,
      workstationName: row.workstation_name,
      workstationType: row.workstation_type,
      deviceUuid: row.device_uuid,
      offlineStatus: row.offline_status,
      syncState: row.sync_state,
      updatedAt: row.updated_at,
    };
  }

  private async getTenant(user: AuthUser) {
    const result = await this.db.query<TenantRow>(
      `SELECT tenant_id, tenant_code, tenant_name FROM tenants WHERE tenant_id = $1 LIMIT 1`,
      [user.tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('TENANT_NOT_FOUND');
    return {
      tenantId: row.tenant_id,
      tenantCode: row.tenant_code,
      tenantName: row.tenant_name,
    };
  }

  private async getSite(user: AuthUser, siteId: string) {
    const result = await this.db.query<SiteRow>(
      `SELECT site_id, site_code, site_name FROM sites WHERE tenant_id = $1 AND site_id = $2 LIMIT 1`,
      [user.tenantId, siteId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('SITE_NOT_FOUND');
    return {
      siteId: row.site_id,
      siteCode: row.site_code,
      siteName: row.site_name,
    };
  }

  private async getExchangeRate(user: AuthUser) {
    const result = await this.db.query<ExchangeRateRow>(
      `
      SELECT setting_value, updated_at
      FROM tenant_settings
      WHERE tenant_id = $1
        AND setting_key = 'USD_CDF_RATE'
      LIMIT 1
      `,
      [user.tenantId],
    );
    const row = result.rows[0];
    return row
      ? {
          fromCurrency: 'USD',
          toCurrency: 'CDF',
          rate: Number(row.setting_value),
          effectiveDate: row.updated_at ? row.updated_at.toISOString() : null,
          updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
        }
      : null;
  }

  private async getOfflineSettings(user: AuthUser) {
    const result = await this.db.query<OfflineSettingsRow>(
      `
      SELECT
        'USD'::varchar AS default_currency,
        ARRAY['USD', 'CDF']::varchar[] AS supported_currencies,
        (
          SELECT setting_value
          FROM tenant_settings
          WHERE tenant_id = $1
            AND setting_key = 'OFFLINE_AUTHORIZATION_HOURS'
          LIMIT 1
        ) AS offline_hours,
        (
          SELECT setting_value
          FROM tenant_settings
          WHERE tenant_id = $1
            AND setting_key = 'TIMEZONE'
          LIMIT 1
        ) AS timezone
      `,
      [user.tenantId],
    );
    const row = result.rows[0];
    return {
      defaultCurrency: row?.default_currency ?? 'USD',
      supportedCurrencies: row?.supported_currencies ?? ['USD', 'CDF'],
      offlineAuthorizationHours: Number(row?.offline_hours ?? DEFAULT_OFFLINE_AUTHORIZATION_HOURS),
      timezone: row?.timezone ?? DEFAULT_TIMEZONE,
    };
  }

  private async getBootstrapArticles(user: AuthUser, workstation: { workstationId: string }) {
    const result = await this.db.query<ArticleBootstrapRow>(
      `
      SELECT DISTINCT
        a.article_id,
        a.article_code,
        a.commercial_name,
        a.barcode,
        a.is_active,
        pu.unit_label AS sales_unit,
        a.packaging,
        a.units_per_package AS packaging_quantity,
        l.selling_price AS default_selling_price,
        a.updated_at
      FROM offline_stock_allocations osa
      JOIN lots l ON l.lot_id = osa.lot_id
      JOIN articles a ON a.article_id = osa.article_id
      LEFT JOIN product_units pu ON pu.product_unit_id = a.sales_unit_id
      WHERE osa.tenant_id = $1
        AND osa.workstation_id = $2
      ORDER BY a.commercial_name ASC
      `,
      [user.tenantId, workstation.workstationId],
    );
    return result.rows.map((row) => ({
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      barcode: row.barcode,
      isActive: row.is_active,
      salesUnit: row.sales_unit,
      packaging: row.packaging,
      packagingQuantity: row.packaging_quantity === null ? null : Number(row.packaging_quantity),
      defaultSellingPrice: row.default_selling_price === null ? null : Number(row.default_selling_price),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    }));
  }

  private async getBootstrapLots(user: AuthUser, workstation: { workstationId: string }) {
    const result = await this.db.query<LotBootstrapRow>(
      `
      SELECT DISTINCT
        l.lot_id,
        l.article_id,
        l.lot_number,
        l.expiry_date,
        l.is_blocked,
        l.block_reason,
        l.selling_price,
        l.created_at AS changed_at
      FROM offline_stock_allocations osa
      JOIN lots l ON l.lot_id = osa.lot_id
      WHERE osa.tenant_id = $1
        AND osa.workstation_id = $2
      ORDER BY l.expiry_date ASC, l.lot_number ASC
      `,
      [user.tenantId, workstation.workstationId],
    );
    return result.rows.map((row) => ({
      lotId: row.lot_id,
      articleId: row.article_id,
      lotNumber: row.lot_number,
      expiryDate: toIsoDate(row.expiry_date),
      isBlocked: row.is_blocked,
      blockReason: row.block_reason,
      sellingPrice: row.selling_price === null ? null : Number(row.selling_price),
      updatedAt: row.changed_at ? row.changed_at.toISOString() : null,
    }));
  }

  private async getBootstrapAllocations(user: AuthUser, workstation: { workstationId: string; siteId: string }) {
    const result = await this.db.query<AllocationBootstrapRow>(
      `
      SELECT
        allocation_id,
        workstation_id,
        site_id,
        article_id,
        lot_id,
        allocated_quantity,
        consumed_quantity,
        status,
        server_version,
        updated_at
      FROM offline_stock_allocations
      WHERE tenant_id = $1
        AND site_id = $2
        AND workstation_id = $3
      ORDER BY updated_at DESC, allocation_id ASC
      `,
      [user.tenantId, workstation.siteId, workstation.workstationId],
    );
    return result.rows.map((row) => {
      const serverAllocatedQuantity = Number(row.allocated_quantity);
      const serverConsumedQuantity = Number(row.consumed_quantity);
      return {
        allocationId: row.allocation_id,
        workstationId: row.workstation_id,
        siteId: row.site_id,
        articleId: row.article_id,
        lotId: row.lot_id,
        serverAllocatedQuantity,
        serverConsumedQuantity,
        availableQuantityServer: Math.max(0, serverAllocatedQuantity - serverConsumedQuantity),
        status: row.status,
        serverVersion: Number(row.server_version),
        updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
      };
    });
  }

  private async getBootstrapCustomers(user: AuthUser) {
    const result = await this.db.query<CustomerBootstrapRow>(
      `
      SELECT customer_id, customer_code, customer_name, phone, is_active, created_at
      FROM customers
      WHERE tenant_id = $1
        AND is_active = true
      ORDER BY created_at DESC, customer_name ASC
      LIMIT 100
      `,
      [user.tenantId],
    );
    return result.rows.map((row) => ({
      customerId: row.customer_id,
      customerCode: row.customer_code,
      name: row.customer_name,
      phone: row.phone,
      isActive: row.is_active,
      updatedAt: row.created_at ? row.created_at.toISOString() : null,
    }));
  }

  private async getArticleChanges(user: AuthUser, workstation: { workstationId: string }, since: Date | null) {
    const result = await this.db.query<TimestampedArticleChange>(
      `
      SELECT DISTINCT
        a.article_id,
        a.article_code,
        a.commercial_name,
        a.barcode,
        a.is_active,
        pu.unit_label AS sales_unit,
        a.packaging,
        a.units_per_package AS packaging_quantity,
        l.selling_price AS default_selling_price,
        a.updated_at,
        CASE WHEN a.is_active THEN 'UPSERT' ELSE 'DEACTIVATE' END AS operation,
        COALESCE(a.updated_at, a.created_at) AS changed_at
      FROM offline_stock_allocations osa
      JOIN lots l ON l.lot_id = osa.lot_id
      JOIN articles a ON a.article_id = osa.article_id
      LEFT JOIN product_units pu ON pu.product_unit_id = a.sales_unit_id
      WHERE osa.tenant_id = $1
        AND osa.workstation_id = $2
        AND ($3::timestamptz IS NULL OR COALESCE(a.updated_at, a.created_at) > $3::timestamptz)
      ORDER BY changed_at ASC, a.article_code ASC
      `,
      [user.tenantId, workstation.workstationId, since ? since.toISOString() : null],
    );
    return result.rows.map((row) => ({
      operation: row.operation,
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      barcode: row.barcode,
      isActive: row.is_active,
      salesUnit: row.sales_unit,
      packaging: row.packaging,
      packagingQuantity: row.packaging_quantity === null ? null : Number(row.packaging_quantity),
      defaultSellingPrice: row.default_selling_price === null ? null : Number(row.default_selling_price),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    }));
  }

  private async getLotChanges(user: AuthUser, workstation: { workstationId: string }, since: Date | null) {
    const result = await this.db.query<TimestampedLotChange>(
      `
      SELECT DISTINCT
        l.lot_id,
        l.article_id,
        l.lot_number,
        l.expiry_date,
        l.is_blocked,
        l.block_reason,
        l.selling_price,
        l.created_at AS changed_at,
        CASE WHEN l.is_blocked THEN 'REVOKE' ELSE 'UPSERT' END AS operation
      FROM offline_stock_allocations osa
      JOIN lots l ON l.lot_id = osa.lot_id
      WHERE osa.tenant_id = $1
        AND osa.workstation_id = $2
        AND ($3::timestamptz IS NULL OR l.created_at > $3::timestamptz)
      ORDER BY changed_at ASC, l.lot_number ASC
      `,
      [user.tenantId, workstation.workstationId, since ? since.toISOString() : null],
    );
    return result.rows.map((row) => ({
      operation: row.operation,
      lotId: row.lot_id,
      articleId: row.article_id,
      lotNumber: row.lot_number,
      expiryDate: toIsoDate(row.expiry_date),
      isBlocked: row.is_blocked,
      blockReason: row.block_reason,
      sellingPrice: row.selling_price === null ? null : Number(row.selling_price),
      updatedAt: row.changed_at ? row.changed_at.toISOString() : null,
    }));
  }

  private async getAllocationChanges(user: AuthUser, workstation: { workstationId: string; siteId: string }, since: Date | null) {
    const result = await this.db.query<TimestampedAllocationChange>(
      `
      SELECT
        allocation_id,
        workstation_id,
        site_id,
        article_id,
        lot_id,
        allocated_quantity,
        consumed_quantity,
        status,
        server_version,
        updated_at,
        CASE WHEN status IN ('REVOKED', 'SUSPENDED') THEN 'REVOKE' ELSE 'UPSERT' END AS operation,
        updated_at AS changed_at
      FROM offline_stock_allocations
      WHERE tenant_id = $1
        AND site_id = $2
        AND workstation_id = $3
        AND ($4::timestamptz IS NULL OR updated_at > $4::timestamptz)
      ORDER BY updated_at ASC, allocation_id ASC
      `,
      [user.tenantId, workstation.siteId, workstation.workstationId, since ? since.toISOString() : null],
    );
    return result.rows.map((row) => {
      const serverAllocatedQuantity = Number(row.allocated_quantity);
      const serverConsumedQuantity = Number(row.consumed_quantity);
      return {
        operation: row.operation,
        allocationId: row.allocation_id,
        workstationId: row.workstation_id,
        siteId: row.site_id,
        articleId: row.article_id,
        lotId: row.lot_id,
        serverAllocatedQuantity,
        serverConsumedQuantity,
        availableQuantityServer: Math.max(0, serverAllocatedQuantity - serverConsumedQuantity),
        status: row.status,
        serverVersion: Number(row.server_version),
        updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
      };
    });
  }

  private async getCustomerChanges(user: AuthUser, since: Date | null) {
    const result = await this.db.query<TimestampedCustomerChange>(
      `
      SELECT
        customer_id,
        customer_code,
        customer_name,
        phone,
        is_active,
        created_at,
        CASE WHEN is_active THEN 'UPSERT' ELSE 'DEACTIVATE' END AS operation,
        created_at AS changed_at
      FROM customers
      WHERE tenant_id = $1
        AND ($2::timestamptz IS NULL OR created_at > $2::timestamptz)
      ORDER BY created_at ASC, customer_name ASC
      LIMIT 100
      `,
      [user.tenantId, since ? since.toISOString() : null],
    );
    return result.rows.map((row) => ({
      operation: row.operation,
      customerId: row.customer_id,
      customerCode: row.customer_code,
      name: row.customer_name,
      phone: row.phone,
      isActive: row.is_active,
      updatedAt: row.created_at ? row.created_at.toISOString() : null,
    }));
  }

  private async getSettingsChanges(user: AuthUser, since: Date | null) {
    const result = await this.db.query<TimestampedSettingsChange>(
      `
      SELECT
        'UPSERT' AS operation,
        updated_at AS changed_at,
        setting_value AS rate,
        updated_at
      FROM tenant_settings
      WHERE tenant_id = $1
        AND setting_key = 'USD_CDF_RATE'
        AND ($2::timestamptz IS NULL OR updated_at > $2::timestamptz)
      ORDER BY updated_at ASC
      `,
      [user.tenantId, since ? since.toISOString() : null],
    );
    return result.rows.map((row) => ({
      operation: row.operation,
      exchangeRate: row.rate === null ? null : Number(row.rate),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    }));
  }

  private async assertSiteAllowed(user: AuthUser, siteId: string) {
    if (user.siteId && user.siteId !== siteId) throw new BadRequestException('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM sites WHERE tenant_id = $1 AND site_id = $2 AND is_active = true`,
      [user.tenantId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new BadRequestException('SITE_NOT_IN_TENANT');
  }

  private async insertAudit(user: AuthUser, recordId: string, actionType: 'INSERT' | 'UPDATE', payload: unknown) {
    await this.db.query(
      `
      INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
      VALUES ($1, $2, $3, 'pos_workstations', $4, $5, $6::jsonb)
      `,
      [user.tenantId, user.siteId ?? null, user.userId, recordId, actionType, JSON.stringify(payload)],
    );
  }
}

function encodeCursor(serverTime: string) {
  return Buffer.from(JSON.stringify({ serverTime }), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string | null) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { serverTime?: string };
    if (!parsed.serverTime) return null;
    const date = new Date(parsed.serverTime);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function toIsoDate(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
