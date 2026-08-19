import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { BootstrapPosDto } from './dto/bootstrap-pos.dto';
import { HeartbeatPosDto } from './dto/heartbeat-pos.dto';
import { ListPosChangesDto } from './dto/list-pos-changes.dto';
import { ListPosSyncAdminDto } from './dto/list-pos-sync-admin.dto';
import { RegisterPosWorkstationDto } from './dto/register-pos-workstation.dto';
import { ResolvePosSyncConflictDto } from './dto/resolve-pos-sync-conflict.dto';
import { SubmitPosSaleValidateOperation } from './dto/submit-pos-operations.dto';

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

type OrganizationBootstrapRow = {
  organization_id: string;
  organization_code: string;
  organization_name: string;
  organization_type: string;
  is_active: boolean;
  created_at: Date | null;
};

type InsurancePlanBootstrapRow = {
  plan_id: string;
  organization_id: string;
  plan_code: string;
  plan_name: string;
  coverage_percent: string;
  patient_copay_percent: string;
  monthly_limit: string | null;
  annual_limit: string | null;
  requires_authorization: boolean;
  is_active: boolean;
  created_at: Date | null;
};

type MembershipBootstrapRow = {
  membership_id: string;
  customer_id: string;
  customer_name: string | null;
  organization_id: string;
  organization_name: string | null;
  plan_id: string | null;
  plan_name: string | null;
  coverage_percent: string | null;
  member_number: string | null;
  employee_number: string | null;
  relationship_type: string | null;
  valid_from: string | null;
  valid_to: string | null;
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

type CashSessionBootstrapRow = {
  cash_session_id: string;
  user_id: string;
  site_id: string;
  workstation_id: string | null;
  status: string;
  opened_at: Date;
  opening_balance: string | null;
  counted_closing_balance_usd: string | null;
  counted_closing_balance_cdf: string | null;
  updated_at: Date | null;
};

type WorkstationStatusRow = {
  workstation_id: string;
  workstation_code: string;
  workstation_name: string;
  workstation_type: string;
  site_id: string | null;
  site_name: string | null;
  device_uuid: string | null;
  is_active: boolean;
  offline_status: string;
  sync_state: string;
  last_seen_at: Date | null;
  last_sync_at: Date | null;
  last_successful_sync_at: Date | null;
  pending_count: number | string | null;
  conflict_count: number | string | null;
  snapshot_status: string | null;
  app_version: string | null;
  local_db_version: string | null;
  user_id: string | null;
  user_name: string | null;
};

type PosSyncConflictRow = {
  conflict_id: string;
  tenant_id: string;
  site_id: string | null;
  site_name: string | null;
  workstation_id: string | null;
  workstation_name: string | null;
  operation_id: string;
  local_sale_id: string | null;
  offline_reference: string | null;
  conflict_code: string;
  status: string;
  severity: string;
  message: string;
  local_payload: Record<string, unknown>;
  server_context: Record<string, unknown>;
  resolution_type: string | null;
  resolution_payload: Record<string, unknown> | null;
  created_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
};

type PosSyncConflictChangeRow = {
  conflict_id: string;
  workstation_id: string | null;
  operation_id: string;
  local_sale_id: string | null;
  offline_reference: string | null;
  conflict_code: string;
  status: string;
  severity: string;
  message: string;
  resolution_type: string | null;
  created_at: Date;
  resolved_at: Date | null;
};

type PosSyncLogRow = {
  event_at: Date;
  event_type: string;
  level: string;
  site_name: string | null;
  workstation_name: string | null;
  message: string;
};

type TimestampedArticleChange = ArticleBootstrapRow & { operation: 'UPSERT' | 'DEACTIVATE'; changed_at: Date | null };
type TimestampedLotChange = LotBootstrapRow & { operation: 'UPSERT' | 'REVOKE'; changed_at: Date | null };
type TimestampedAllocationChange = AllocationBootstrapRow & { operation: 'UPSERT' | 'REVOKE'; changed_at: Date | null };
type TimestampedCustomerChange = CustomerBootstrapRow & { operation: 'UPSERT' | 'DEACTIVATE'; changed_at: Date | null };
type TimestampedOrganizationChange = OrganizationBootstrapRow & { operation: 'UPSERT' | 'DEACTIVATE'; changed_at: Date | null };
type TimestampedInsurancePlanChange = InsurancePlanBootstrapRow & { operation: 'UPSERT' | 'DEACTIVATE'; changed_at: Date | null };
type TimestampedMembershipChange = MembershipBootstrapRow & { operation: 'UPSERT' | 'DEACTIVATE'; changed_at: Date | null };
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
    const [tenant, site, exchangeRate, settings, cashSession, articles, lots, allocations, customers, organizations, insurancePlans, memberships] = await Promise.all([
      this.getTenant(user),
      this.getSite(user, workstation.siteId),
      this.getExchangeRate(user),
      this.getOfflineSettings(user),
      this.getBootstrapCashSession(user, workstation),
      this.getBootstrapArticles(user, workstation),
      this.getBootstrapLots(user, workstation),
      this.getBootstrapAllocations(user, workstation),
      this.getBootstrapCustomers(user),
      this.getBootstrapOrganizations(user),
      this.getBootstrapInsurancePlans(user),
      this.getBootstrapMemberships(user),
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
      cashSession,
      articles,
      lots,
      offlineAllocations: allocations,
      customers,
      organizations,
      insurancePlans,
      memberships,
    };
  }

  async listChanges(user: AuthUser, query: ListPosChangesDto) {
    this.assertOfflinePermissions(user);
    const workstation = await this.resolveWorkstation(user, query);
    const since = decodeCursor(query.cursor);
    const [articles, lots, allocations, customers, organizations, insurancePlans, memberships, settings, conflicts] = await Promise.all([
      this.getArticleChanges(user, workstation, since),
      this.getLotChanges(user, workstation, since),
      this.getAllocationChanges(user, workstation, since),
      this.getCustomerChanges(user, since),
      this.getOrganizationChanges(user, since),
      this.getInsurancePlanChanges(user, since),
      this.getMembershipChanges(user, since),
      this.getSettingsChanges(user, since),
      this.listConflictChanges(user, { workstationId: workstation.workstationId, since }),
    ]);
    const serverTime = new Date().toISOString();
    return {
      serverTime,
      previousCursor: query.cursor ?? null,
      nextCursor: encodeCursor(serverTime),
      hasMore: false,
      changes: { articles, lots, allocations, customers, organizations, insurancePlans, memberships, settings, conflicts, cashSession: null },
    };
  }

  async heartbeat(user: AuthUser, dto: HeartbeatPosDto) {
    this.assertOfflineReadPermissions(user);
    const workstation = await this.resolveWorkstation(user, dto);
    const lastSyncAt = parseOptionalDate(dto.lastSyncAt);
    const lastSuccessfulSyncAt = parseOptionalDate(dto.lastSuccessfulSyncAt);
    const snapshotStatus = dto.snapshotStatus ?? 'UNKNOWN';
    const pendingCount = Math.max(0, Number(dto.pendingCount ?? 0));
    const conflictCount = Math.max(0, Number(dto.conflictCount ?? 0));

    await this.db.query(
      `
      INSERT INTO pos_workstation_status (
        tenant_id, site_id, workstation_id, device_id, user_id, app_version,
        local_db_version, sync_cursor, pending_count, conflict_count, snapshot_status,
        last_seen_at, last_sync_at, last_successful_sync_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP,$12,$13,CURRENT_TIMESTAMP)
      ON CONFLICT (workstation_id) DO UPDATE SET
        site_id = EXCLUDED.site_id,
        device_id = EXCLUDED.device_id,
        user_id = EXCLUDED.user_id,
        app_version = EXCLUDED.app_version,
        local_db_version = EXCLUDED.local_db_version,
        sync_cursor = EXCLUDED.sync_cursor,
        pending_count = EXCLUDED.pending_count,
        conflict_count = EXCLUDED.conflict_count,
        snapshot_status = EXCLUDED.snapshot_status,
        last_seen_at = CURRENT_TIMESTAMP,
        last_sync_at = COALESCE(EXCLUDED.last_sync_at, pos_workstation_status.last_sync_at),
        last_successful_sync_at = COALESCE(EXCLUDED.last_successful_sync_at, pos_workstation_status.last_successful_sync_at),
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        user.tenantId,
        workstation.siteId,
        workstation.workstationId,
        dto.deviceId ?? workstation.deviceUuid ?? null,
        user.userId,
        dto.appVersion ?? null,
        dto.localDbVersion ?? null,
        dto.syncCursor ?? null,
        pendingCount,
        conflictCount,
        snapshotStatus,
        lastSyncAt,
        lastSuccessfulSyncAt,
      ],
    );

    await this.db.query(
      `
      UPDATE pos_workstations
      SET sync_state = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1
        AND workstation_id = $2
      `,
      [
        user.tenantId,
        workstation.workstationId,
        conflictCount > 0 ? 'CONFLICT' : pendingCount > 0 ? 'PENDING' : 'SYNCED',
      ],
    );

    return {
      workstationId: workstation.workstationId,
      status: this.computeWorkstationStatus({
        isActive: true,
        offlineStatus: workstation.offlineStatus,
        snapshotStatus,
        lastSeenAt: new Date(),
        conflictCount,
      }),
      serverTime: new Date().toISOString(),
    };
  }

  async adminDashboard(user: AuthUser, query: ListPosSyncAdminDto) {
    this.assertOfflineAdminPermissions(user, 'pos_offline.admin.read');
    const workstations = await this.adminWorkstations(user, query);
    const conflicts = await this.adminConflicts(user, query);
    const allocations = await this.db.query<{ active_allocations: string; reserved_quantity: string }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_allocations,
        COALESCE(SUM(GREATEST(allocated_quantity - consumed_quantity, 0)), 0)::numeric AS reserved_quantity
      FROM offline_stock_allocations
      WHERE tenant_id = $1
        AND ($2::uuid IS NULL OR site_id = $2::uuid)
      `,
      [user.tenantId, query.siteId ?? user.siteId ?? null],
    );
    const freeOnline = await this.db.query<{ free_quantity: string }>(
      `
      SELECT COALESCE(SUM(quantity_available), 0)::numeric
             - COALESCE((
                SELECT SUM(GREATEST(allocated_quantity - consumed_quantity, 0))
                FROM offline_stock_allocations
                WHERE tenant_id = $1
                  AND ($2::uuid IS NULL OR site_id = $2::uuid)
                  AND status = 'ACTIVE'
             ), 0)::numeric AS free_quantity
      FROM stocks
      WHERE tenant_id = $1
        AND ($2::uuid IS NULL OR site_id = $2::uuid)
      `,
      [user.tenantId, query.siteId ?? user.siteId ?? null],
    );

    return {
      workstations: {
        total: workstations.length,
        online: workstations.filter((row) => row.status === 'ONLINE').length,
        offline: workstations.filter((row) => row.status === 'OFFLINE').length,
        degraded: workstations.filter((row) => row.status === 'DEGRADED').length,
        stale: workstations.filter((row) => row.status === 'STALE').length,
        revoked: workstations.filter((row) => row.status === 'REVOKED').length,
      },
      queue: {
        pending: workstations.reduce((sum, row) => sum + row.pendingCount, 0),
        conflicts: conflicts.filter((row) => row.status === 'OPEN' || row.status === 'UNDER_REVIEW').length,
      },
      allocations: {
        active: Number(allocations.rows[0]?.active_allocations ?? 0),
        reservedQuantity: Number(allocations.rows[0]?.reserved_quantity ?? 0),
        freeOnlineQuantity: Number(freeOnline.rows[0]?.free_quantity ?? 0),
      },
    };
  }

  async adminWorkstations(user: AuthUser, query: ListPosSyncAdminDto) {
    this.assertOfflineAdminPermissions(user, 'pos_offline.workstations.read');
    const result = await this.db.query<WorkstationStatusRow>(
      `
      SELECT
        w.workstation_id,
        w.workstation_code,
        w.workstation_name,
        w.workstation_type,
        w.site_id,
        s.site_name,
        w.device_uuid,
        w.is_active,
        w.offline_status,
        w.sync_state,
        pws.last_seen_at,
        pws.last_sync_at,
        pws.last_successful_sync_at,
        pws.pending_count,
        pws.conflict_count,
        pws.snapshot_status,
        pws.app_version,
        pws.local_db_version,
        pws.user_id,
        u.full_name AS user_name
      FROM pos_workstations w
      LEFT JOIN sites s
        ON s.tenant_id = w.tenant_id
       AND s.site_id = w.site_id
      LEFT JOIN pos_workstation_status pws
        ON pws.workstation_id = w.workstation_id
      LEFT JOIN users u
        ON u.tenant_id = w.tenant_id
       AND u.user_id = pws.user_id
      WHERE w.tenant_id = $1
        AND ($2::uuid IS NULL OR w.site_id = $2::uuid)
        AND ($3::uuid IS NULL OR w.workstation_id = $3::uuid)
        AND (
          $4::varchar IS NULL
          OR w.workstation_name ILIKE '%' || $4 || '%'
          OR w.workstation_code ILIKE '%' || $4 || '%'
          OR COALESCE(s.site_name, '') ILIKE '%' || $4 || '%'
          OR COALESCE(u.full_name, '') ILIKE '%' || $4 || '%'
        )
      ORDER BY COALESCE(pws.last_seen_at, w.updated_at) DESC, w.workstation_name ASC
      `,
      [user.tenantId, query.siteId ?? user.siteId ?? null, query.workstationId ?? null, query.search?.trim() || null],
    );

    return result.rows
      .map((row) => this.toAdminWorkstation(row))
      .filter((row) => !query.status || row.status === query.status);
  }

  async adminWorkstation(user: AuthUser, id: string) {
    const rows = await this.adminWorkstations(user, { workstationId: id });
    const workstation = rows[0];
    if (!workstation) throw new NotFoundException('WORKSTATION_NOT_FOUND');

    const [allocations, conflicts] = await Promise.all([
      this.db.query<{ total: string; reserved: string }>(
        `
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(GREATEST(allocated_quantity - consumed_quantity, 0)), 0)::numeric AS reserved
        FROM offline_stock_allocations
        WHERE tenant_id = $1
          AND workstation_id = $2
        `,
        [user.tenantId, id],
      ),
      this.db.query<{ total: string }>(
        `
        SELECT COUNT(*)::int AS total
        FROM pos_sync_conflicts
        WHERE tenant_id = $1
          AND workstation_id = $2
          AND status IN ('OPEN', 'UNDER_REVIEW')
        `,
        [user.tenantId, id],
      ),
    ]);

    return {
      ...workstation,
      allocationSummary: {
        total: Number(allocations.rows[0]?.total ?? 0),
        reservedQuantity: Number(allocations.rows[0]?.reserved ?? 0),
      },
      openConflicts: Number(conflicts.rows[0]?.total ?? 0),
    };
  }

  async revokeWorkstation(user: AuthUser, id: string) {
    this.assertOfflineAdminPermissions(user, 'pos_offline.workstations.read');
    const workstation = await this.resolveWorkstationForAdmin(user, id);

    await this.db.transaction(async (client) => {
      await client.query(
        `
        UPDATE pos_workstations
        SET offline_status = 'REVOKED',
            sync_state = 'REVOKED',
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND workstation_id = $2
        `,
        [user.tenantId, id],
      );

      await client.query(
        `
        UPDATE offline_stock_allocations
        SET allocated_quantity = consumed_quantity,
            status = CASE
              WHEN consumed_quantity > 0 THEN 'EXHAUSTED'
              ELSE 'REVOKED'
            END,
            server_version = server_version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
          AND workstation_id = $2
          AND status <> 'REVOKED'
        `,
        [user.tenantId, id],
      );

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1, $2, $3, 'pos_workstations', $4, 'UPDATE', $5::jsonb)
        `,
        [
          user.tenantId,
          workstation.siteId ?? user.siteId ?? null,
          user.userId,
          id,
          JSON.stringify({
            action: 'POS_OFFLINE_WORKSTATION_REVOKE',
            workstationId: id,
            workstationName: workstation.workstationName,
            deviceId: workstation.deviceId,
          }),
        ],
      );
    });

    return this.adminWorkstation(user, id);
  }

  async adminConflicts(user: AuthUser, query: ListPosSyncAdminDto) {
    this.assertOfflineAdminPermissions(user, 'pos_sync.conflicts.read');
    const result = await this.db.query<PosSyncConflictRow>(
      `
      SELECT
        c.conflict_id,
        c.tenant_id,
        c.site_id,
        s.site_name,
        c.workstation_id,
        w.workstation_name,
        c.operation_id,
        c.local_sale_id,
        c.offline_reference,
        c.conflict_code,
        c.status,
        c.severity,
        c.message,
        c.local_payload,
        c.server_context,
        c.resolution_type,
        c.resolution_payload,
        c.created_at,
        c.resolved_at,
        c.resolved_by,
        u.full_name AS resolved_by_name
      FROM pos_sync_conflicts c
      LEFT JOIN sites s ON s.site_id = c.site_id AND s.tenant_id = c.tenant_id
      LEFT JOIN pos_workstations w ON w.workstation_id = c.workstation_id AND w.tenant_id = c.tenant_id
      LEFT JOIN users u ON u.user_id = c.resolved_by AND u.tenant_id = c.tenant_id
      WHERE c.tenant_id = $1
        AND ($2::uuid IS NULL OR c.site_id = $2::uuid)
        AND ($3::uuid IS NULL OR c.workstation_id = $3::uuid)
        AND ($4::varchar IS NULL OR c.status = $4::varchar)
        AND ($5::varchar IS NULL OR c.severity = $5::varchar)
        AND (
          $6::varchar IS NULL
          OR c.offline_reference ILIKE '%' || $6 || '%'
          OR c.conflict_code ILIKE '%' || $6 || '%'
          OR c.message ILIKE '%' || $6 || '%'
        )
      ORDER BY c.created_at DESC
      `,
      [
        user.tenantId,
        query.siteId ?? user.siteId ?? null,
        query.workstationId ?? null,
        query.conflictStatus ?? null,
        query.severity ?? null,
        query.search?.trim() || null,
      ],
    );
    return result.rows.map((row) => this.toAdminConflict(row));
  }

  async adminConflict(user: AuthUser, id: string) {
    const rows = await this.adminConflicts(user, { search: undefined });
    const conflict = rows.find((row) => row.conflictId === id);
    if (!conflict) throw new NotFoundException('POS_SYNC_CONFLICT_NOT_FOUND');
    return conflict;
  }

  async resolveConflict(user: AuthUser, id: string, dto: ResolvePosSyncConflictDto) {
    this.assertOfflineAdminPermissions(user, 'pos_sync.conflicts.resolve');
    const result = await this.db.query<PosSyncConflictRow>(
      `
      UPDATE pos_sync_conflicts
      SET status = CASE
            WHEN $3::varchar = 'UNDER_REVIEW' THEN 'UNDER_REVIEW'
            WHEN $3::varchar = 'DISMISS' THEN 'DISMISSED'
            ELSE 'RESOLVED'
          END,
          resolution_type = $3,
          resolution_payload = $4::jsonb,
          resolved_at = CASE WHEN $3::varchar = 'UNDER_REVIEW' THEN NULL ELSE CURRENT_TIMESTAMP END,
          resolved_by = CASE WHEN $3::varchar = 'UNDER_REVIEW' THEN NULL ELSE $2::uuid END
      WHERE tenant_id = $1
        AND conflict_id = $5
      RETURNING *
      `,
      [
        user.tenantId,
        user.userId,
        dto.resolutionType,
        JSON.stringify({
          note: dto.note ?? null,
          targetCashSessionId: dto.targetCashSessionId ?? null,
          payload: dto.payload ?? null,
        }),
        id,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException('POS_SYNC_CONFLICT_NOT_FOUND');
    await this.db.query(
      `
      INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
      VALUES ($1, $2, $3, 'pos_sync_conflicts', $4, 'UPDATE', $5::jsonb)
      `,
      [
        user.tenantId,
        user.siteId ?? null,
        user.userId,
        id,
        JSON.stringify({
          resolutionType: dto.resolutionType,
          note: dto.note ?? null,
          targetCashSessionId: dto.targetCashSessionId ?? null,
        }),
      ],
    );
    return this.toAdminConflict(result.rows[0]);
  }

  async listConflictChanges(user: AuthUser, params: { workstationId?: string | null; since: Date | null }) {
    const result = await this.db.query<PosSyncConflictChangeRow>(
      `
      SELECT
        conflict_id,
        workstation_id,
        operation_id,
        local_sale_id,
        offline_reference,
        conflict_code,
        status,
        severity,
        message,
        resolution_type,
        created_at,
        resolved_at
      FROM pos_sync_conflicts
      WHERE tenant_id = $1
        AND ($2::uuid IS NULL OR workstation_id = $2::uuid)
        AND ($3::timestamptz IS NULL OR GREATEST(created_at, COALESCE(resolved_at, created_at)) > $3::timestamptz)
      ORDER BY GREATEST(created_at, COALESCE(resolved_at, created_at)) ASC, conflict_id ASC
      `,
      [user.tenantId, params.workstationId ?? null, params.since ? params.since.toISOString() : null],
    );

    return result.rows.map((row) => ({
      operation: row.status === 'RESOLVED' || row.status === 'DISMISSED' ? 'RESOLVE' : 'UPSERT',
      conflictId: row.conflict_id,
      workstationId: row.workstation_id,
      operationId: row.operation_id,
      localSaleId: row.local_sale_id,
      offlineReference: row.offline_reference,
      conflictCode: row.conflict_code,
      status: row.status,
      severity: row.severity,
      message: row.message,
      resolutionType: row.resolution_type,
      updatedAt: (row.resolved_at ?? row.created_at).toISOString(),
    }));
  }

  async adminLogs(user: AuthUser, query: ListPosSyncAdminDto) {
    this.assertOfflineAdminPermissions(user, 'pos_sync.logs.read');
    const result = await this.db.query<PosSyncLogRow>(
      `
      SELECT *
      FROM (
        SELECT
          COALESCE(pws.updated_at, pws.last_seen_at) AS event_at,
          'HEARTBEAT'::varchar AS event_type,
          CASE WHEN COALESCE(pws.conflict_count, 0) > 0 THEN 'WARNING' ELSE 'INFO' END AS level,
          s.site_name,
          w.workstation_name,
          CONCAT('Heartbeat ', w.workstation_name, ' - pending=', COALESCE(pws.pending_count, 0), ' conflit=', COALESCE(pws.conflict_count, 0)) AS message
        FROM pos_workstation_status pws
        JOIN pos_workstations w ON w.workstation_id = pws.workstation_id AND w.tenant_id = pws.tenant_id
        LEFT JOIN sites s ON s.site_id = pws.site_id AND s.tenant_id = pws.tenant_id
        WHERE pws.tenant_id = $1
          AND ($2::uuid IS NULL OR pws.site_id = $2::uuid)

        UNION ALL

        SELECT
          c.created_at AS event_at,
          'CONFLICT'::varchar AS event_type,
          c.severity AS level,
          s.site_name,
          w.workstation_name,
          c.message
        FROM pos_sync_conflicts c
        LEFT JOIN sites s ON s.site_id = c.site_id AND s.tenant_id = c.tenant_id
        LEFT JOIN pos_workstations w ON w.workstation_id = c.workstation_id AND w.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1
          AND ($2::uuid IS NULL OR c.site_id = $2::uuid)

        UNION ALL

        SELECT
          processed_at AS event_at,
          'SYNC_SUCCESS'::varchar AS event_type,
          'INFO'::varchar AS level,
          s.site_name,
          w.workstation_name,
          CONCAT('Operation ', operation_type, ' synchronisee pour ', COALESCE(server_sale_number, local_sale_id::text)) AS message
        FROM pos_sync_operations pso
        LEFT JOIN sites s ON s.site_id = pso.site_id AND s.tenant_id = pso.tenant_id
        LEFT JOIN pos_workstations w ON w.site_id = pso.site_id AND w.tenant_id = pso.tenant_id
        WHERE pso.tenant_id = $1
          AND ($2::uuid IS NULL OR pso.site_id = $2::uuid)
      ) logs
      WHERE ($3::varchar IS NULL OR logs.event_type = $3::varchar)
      ORDER BY logs.event_at DESC
      LIMIT 200
      `,
      [user.tenantId, query.siteId ?? user.siteId ?? null, query.search?.trim() || null],
    );
    return result.rows.map((row) => ({
      eventAt: row.event_at.toISOString(),
      eventType: row.event_type,
      level: row.level,
      siteName: row.site_name,
      workstationName: row.workstation_name,
      message: row.message,
    }));
  }

  async findProcessedOperation(user: AuthUser, operationId: string) {
    const result = await this.db.query<{
      server_sale_id: string | null;
      server_sale_number: string | null;
      payload_json: Record<string, unknown> | null;
    }>(
      `
      SELECT server_sale_id, server_sale_number, payload_json
      FROM pos_sync_operations
      WHERE tenant_id = $1
        AND operation_id = $2
      LIMIT 1
      `,
      [user.tenantId, operationId],
    );
    const row = result.rows[0];
    return row
      ? {
          serverSaleId: row.server_sale_id,
          serverSaleNumber: row.server_sale_number,
          serverCashSessionId: typeof row.payload_json?.['serverCashSessionId'] === 'string' ? String(row.payload_json['serverCashSessionId']) : null,
          serverSessionReference: typeof row.payload_json?.['serverSessionReference'] === 'string' ? String(row.payload_json['serverSessionReference']) : null,
          serverMovementId: typeof row.payload_json?.['serverMovementId'] === 'string' ? String(row.payload_json['serverMovementId']) : null,
          serverVersion: typeof row.payload_json?.['serverVersion'] === 'number' ? Number(row.payload_json['serverVersion']) : null,
          serverOpenedAt: typeof row.payload_json?.['serverOpenedAt'] === 'string' ? String(row.payload_json['serverOpenedAt']) : null,
          serverClosedAt: typeof row.payload_json?.['serverClosedAt'] === 'string' ? String(row.payload_json['serverClosedAt']) : null,
          serverExpectedUsd: typeof row.payload_json?.['serverExpectedUsd'] === 'number' ? Number(row.payload_json['serverExpectedUsd']) : null,
          serverExpectedCdf: typeof row.payload_json?.['serverExpectedCdf'] === 'number' ? Number(row.payload_json['serverExpectedCdf']) : null,
          serverDeclaredUsd: typeof row.payload_json?.['serverDeclaredUsd'] === 'number' ? Number(row.payload_json['serverDeclaredUsd']) : null,
          serverDeclaredCdf: typeof row.payload_json?.['serverDeclaredCdf'] === 'number' ? Number(row.payload_json['serverDeclaredCdf']) : null,
          serverDifferenceUsd: typeof row.payload_json?.['serverDifferenceUsd'] === 'number' ? Number(row.payload_json['serverDifferenceUsd']) : null,
          serverDifferenceCdf: typeof row.payload_json?.['serverDifferenceCdf'] === 'number' ? Number(row.payload_json['serverDifferenceCdf']) : null,
        }
      : null;
  }

  async recordProcessedOperation(user: AuthUser, params: {
    operationId: string;
    localEntityId: string;
    operationType: string;
    payload: unknown;
    serverSaleId?: string | null;
    serverSaleNumber: string | null;
    serverCashSessionId?: string | null;
    serverSessionReference?: string | null;
    serverMovementId?: string | null;
    serverVersion?: number | null;
    serverOpenedAt?: string | null;
    serverClosedAt?: string | null;
    serverExpectedUsd?: number | null;
    serverExpectedCdf?: number | null;
    serverDeclaredUsd?: number | null;
    serverDeclaredCdf?: number | null;
    serverDifferenceUsd?: number | null;
    serverDifferenceCdf?: number | null;
  }) {
    await this.db.query(
      `
      INSERT INTO pos_sync_operations (
        tenant_id,
        site_id,
        user_id,
        operation_id,
        local_sale_id,
        operation_type,
        payload_json,
        status,
        server_sale_id,
        server_sale_number,
        processed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'SYNCED', $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, operation_id) DO NOTHING
      `,
      [
        user.tenantId,
        user.siteId ?? null,
        user.userId,
        params.operationId,
        params.localEntityId,
        params.operationType,
        JSON.stringify({
          ...(typeof params.payload === 'object' && params.payload ? params.payload as Record<string, unknown> : {}),
          serverCashSessionId: params.serverCashSessionId ?? null,
          serverSessionReference: params.serverSessionReference ?? null,
          serverMovementId: params.serverMovementId ?? null,
          serverVersion: params.serverVersion ?? null,
          serverOpenedAt: params.serverOpenedAt ?? null,
          serverClosedAt: params.serverClosedAt ?? null,
          serverExpectedUsd: params.serverExpectedUsd ?? null,
          serverExpectedCdf: params.serverExpectedCdf ?? null,
          serverDeclaredUsd: params.serverDeclaredUsd ?? null,
          serverDeclaredCdf: params.serverDeclaredCdf ?? null,
          serverDifferenceUsd: params.serverDifferenceUsd ?? null,
          serverDifferenceCdf: params.serverDifferenceCdf ?? null,
        }),
        params.serverSaleId ?? null,
        params.serverSaleNumber,
      ],
      );
  }

  async getOperationAllocationStates(user: AuthUser, operation: { operationType: string; items?: SubmitPosSaleValidateOperation['items'] }) {
    if (operation.operationType !== 'SALE_VALIDATE' || !operation.items) return [];
    const allocationIds = operation.items.flatMap((item) => item.lotAllocations.map((allocation) => allocation.allocationId));
    if (!allocationIds.length) return [];

    const placeholders = allocationIds.map((_, index) => `$${index + 2}`).join(',');
    const result = await this.db.query<{
      allocation_id: string;
      lot_id: string;
      consumed_quantity: string;
      allocated_quantity: string;
      server_version: string;
      status: string;
    }>(
      `SELECT allocation_id, lot_id, consumed_quantity, allocated_quantity, server_version, status
       FROM offline_stock_allocations
       WHERE tenant_id = $1
         AND allocation_id IN (${placeholders})`,
      [user.tenantId, ...allocationIds],
    );

    return result.rows.map((row) => ({
      allocationId: row.allocation_id,
      lotId: row.lot_id,
      acknowledgedQuantity: 0,
      serverConsumedQuantity: Number(row.consumed_quantity ?? 0),
      availableQuantity: Math.max(
        0,
        Number(row.allocated_quantity ?? 0) - Number(row.consumed_quantity ?? 0),
      ),
      serverVersion: Number(row.server_version ?? 0),
      status: row.status,
    }));
  }

  async ensureWorkstationOperational(user: AuthUser, params: { workstationId?: string; deviceId?: string }) {
    return this.resolveWorkstation(user, params);
  }

  async recordConflict(user: AuthUser, params: {
    operationId: string;
    localSaleId: string;
    workstationId?: string | null;
    siteId?: string | null;
    offlineReference?: string | null;
    conflictCode: string;
    message: string;
    localPayload: unknown;
    serverContext?: unknown;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  }) {
    const normalizedConflictCode = /^[A-Z0-9_]+$/.test(params.conflictCode) && params.conflictCode.length <= 80
      ? params.conflictCode
      : 'POS_SYNC_REPLAY_FAILED';
    const validSiteId = params.siteId
      ? await this.db.query<{ site_id: string }>(
          `SELECT site_id FROM sites WHERE tenant_id = $1 AND site_id = $2 LIMIT 1`,
          [user.tenantId, params.siteId],
        ).then((result) => result.rows[0]?.site_id ?? null)
      : user.siteId ?? null;
    const validWorkstationId = params.workstationId
      ? await this.db.query<{ workstation_id: string }>(
          `SELECT workstation_id FROM pos_workstations WHERE tenant_id = $1 AND workstation_id = $2 LIMIT 1`,
          [user.tenantId, params.workstationId],
        ).then((result) => result.rows[0]?.workstation_id ?? null)
      : null;
    await this.db.query(
      `
      INSERT INTO pos_sync_conflicts (
        tenant_id,
        site_id,
        workstation_id,
        operation_id,
        local_sale_id,
        offline_reference,
        conflict_code,
        status,
        severity,
        message,
        local_payload,
        server_context
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, $10::jsonb, $11::jsonb)
      ON CONFLICT (tenant_id, operation_id) DO UPDATE SET
        site_id = EXCLUDED.site_id,
        workstation_id = EXCLUDED.workstation_id,
        local_sale_id = EXCLUDED.local_sale_id,
        offline_reference = EXCLUDED.offline_reference,
        conflict_code = EXCLUDED.conflict_code,
        status = 'OPEN',
        severity = EXCLUDED.severity,
        message = EXCLUDED.message,
        local_payload = EXCLUDED.local_payload,
        server_context = EXCLUDED.server_context,
        resolution_type = NULL,
        resolution_payload = NULL,
        resolved_at = NULL,
        resolved_by = NULL
      `,
      [
        user.tenantId,
        validSiteId,
        validWorkstationId,
        params.operationId,
        params.localSaleId,
        params.offlineReference ?? null,
        normalizedConflictCode,
        params.severity ?? inferConflictSeverity(normalizedConflictCode),
        params.message,
        JSON.stringify(params.localPayload ?? {}),
        JSON.stringify(params.serverContext ?? {}),
      ],
    );
  }

  private assertOfflineReadPermissions(user: AuthUser) {
    if (
      !user.permissions.includes('pos_sync.read')
      && !user.permissions.includes('offline_allocations.read')
      && user.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private assertOfflineAdminPermissions(user: AuthUser, permission: string) {
    if (!user.permissions.includes(permission) && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private assertOfflinePermissions(user: AuthUser) {
    if (!user.permissions.includes('offline_allocations.read') && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }
  }

  private toAdminWorkstation(row: WorkstationStatusRow) {
    const pendingCount = Number(row.pending_count ?? 0);
    const conflictCount = Number(row.conflict_count ?? 0);
    const lastSeenAt = row.last_seen_at ? row.last_seen_at.toISOString() : null;
    const lastSyncAt = row.last_sync_at ? row.last_sync_at.toISOString() : null;
    const lastSuccessfulSyncAt = row.last_successful_sync_at ? row.last_successful_sync_at.toISOString() : null;

    return {
      workstationId: row.workstation_id,
      workstationCode: row.workstation_code,
      workstationName: row.workstation_name,
      workstationType: row.workstation_type,
      siteId: row.site_id,
      siteName: row.site_name,
      deviceId: row.device_uuid,
      isActive: row.is_active,
      offlineStatus: row.offline_status,
      syncState: row.sync_state,
      snapshotStatus: row.snapshot_status ?? 'UNKNOWN',
      pendingCount,
      conflictCount,
      appVersion: row.app_version,
      localDbVersion: row.local_db_version,
      userId: row.user_id,
      userName: row.user_name,
      lastSeenAt,
      lastSyncAt,
      lastSuccessfulSyncAt,
      status: this.computeWorkstationStatus({
        isActive: row.is_active,
        offlineStatus: row.offline_status,
        snapshotStatus: row.snapshot_status,
        lastSeenAt: row.last_seen_at,
        conflictCount,
      }),
    };
  }

  private toAdminConflict(row: PosSyncConflictRow) {
    return {
      conflictId: row.conflict_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      workstationId: row.workstation_id,
      workstationName: row.workstation_name,
      operationId: row.operation_id,
      localSaleId: row.local_sale_id,
      offlineReference: row.offline_reference,
      conflictCode: row.conflict_code,
      status: row.status,
      severity: row.severity,
      message: row.message,
      localPayload: row.local_payload ?? {},
      serverContext: row.server_context ?? {},
      resolutionType: row.resolution_type,
      resolutionPayload: row.resolution_payload ?? null,
      createdAt: row.created_at.toISOString(),
      resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
      resolvedBy: row.resolved_by,
      resolvedByName: row.resolved_by_name,
    };
  }

  private computeWorkstationStatus(params: {
    isActive: boolean;
    offlineStatus: string | null;
    snapshotStatus: string | null;
    lastSeenAt: Date | null;
    conflictCount: number;
  }): 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'STALE' | 'REVOKED' {
    if (!params.isActive || params.offlineStatus === 'REVOKED') return 'REVOKED';
    if (params.conflictCount > 0) return 'DEGRADED';
    if (!params.lastSeenAt) return 'OFFLINE';

    const ageMs = Date.now() - params.lastSeenAt.getTime();
    if (ageMs > 1000 * 60 * 30) return 'OFFLINE';
    if (ageMs > 1000 * 60 * 5) return 'STALE';
    if (params.snapshotStatus === 'STALE' || params.snapshotStatus === 'EXPIRED') return 'DEGRADED';
    return 'ONLINE';
  }

  private async resolveWorkstationForAdmin(user: AuthUser, workstationId: string) {
    const result = await this.db.query<WorkstationStatusRow>(
      `
      SELECT
        w.workstation_id,
        w.workstation_code,
        w.workstation_name,
        w.workstation_type,
        w.site_id,
        s.site_name,
        w.device_uuid,
        w.is_active,
        w.offline_status,
        w.sync_state,
        pws.last_seen_at,
        pws.last_sync_at,
        pws.last_successful_sync_at,
        pws.pending_count,
        pws.conflict_count,
        pws.snapshot_status,
        pws.app_version,
        pws.local_db_version,
        pws.user_id,
        u.full_name AS user_name
      FROM pos_workstations w
      LEFT JOIN sites s
        ON s.tenant_id = w.tenant_id
       AND s.site_id = w.site_id
      LEFT JOIN pos_workstation_status pws
        ON pws.workstation_id = w.workstation_id
      LEFT JOIN users u
        ON u.tenant_id = w.tenant_id
       AND u.user_id = pws.user_id
      WHERE w.tenant_id = $1
        AND w.workstation_id = $2
      LIMIT 1
      `,
      [user.tenantId, workstationId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('WORKSTATION_NOT_FOUND');
    return this.toAdminWorkstation(row);
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
        AND ($4::uuid IS NULL OR w.site_id = $4::uuid)
        AND (
          ($2::uuid IS NOT NULL AND w.workstation_id = $2::uuid)
          OR ($3::varchar IS NOT NULL AND w.device_uuid = $3::varchar)
        )
      ORDER BY
        CASE WHEN $2::uuid IS NOT NULL AND w.workstation_id = $2::uuid THEN 0 ELSE 1 END,
        CASE WHEN $3::varchar IS NOT NULL AND w.device_uuid = $3::varchar THEN 0 ELSE 1 END,
        w.updated_at DESC NULLS LAST,
        w.created_at DESC NULLS LAST
      LIMIT 1
      `,
      [user.tenantId, query.workstationId ?? null, query.deviceId ?? null, user.siteId ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('WORKSTATION_NOT_FOUND');
    if (!row.is_active) throw new BadRequestException('WORKSTATION_INACTIVE');
    if (!row.site_id) throw new BadRequestException('WORKSTATION_SITE_REQUIRED');
    if (row.offline_status === 'REVOKED') throw new BadRequestException('WORKSTATION_REVOKED');
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

  private async getBootstrapCashSession(
    user: AuthUser,
    workstation: { workstationId: string; siteId: string; deviceUuid: string | null },
  ) {
    const result = await this.db.query<CashSessionBootstrapRow>(
      `
      SELECT
        cs.cash_session_id,
        cs.user_id,
        cs.site_id,
        cs.workstation_id,
        cs.status,
        cs.opened_at,
        cs.opening_balance,
        cs.counted_closing_balance_usd,
        cs.counted_closing_balance_cdf,
        COALESCE(cs.validated_at, cs.closed_at, cs.opened_at) AS updated_at
      FROM cash_sessions cs
      WHERE cs.tenant_id = $1
        AND cs.user_id = $2
        AND cs.site_id = $3
        AND cs.status = 'OPEN'
        AND ($4::uuid IS NULL OR cs.workstation_id = $4::uuid)
        AND ($5::text IS NULL OR cs.device_uuid = $5::text)
      ORDER BY cs.opened_at DESC
      LIMIT 1
      `,
      [user.tenantId, user.userId, workstation.siteId, workstation.workstationId, workstation.deviceUuid ?? null],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      cashSessionId: row.cash_session_id,
      userId: row.user_id,
      siteId: row.site_id,
      workstationId: row.workstation_id,
      status: row.status === 'OPEN' ? 'OPEN' : 'CLOSED',
      openedAt: row.opened_at.toISOString(),
      openingBalanceUsd: Number(row.opening_balance ?? row.counted_closing_balance_usd ?? 0),
      openingBalanceCdf: Number(row.counted_closing_balance_cdf ?? 0),
      serverVersion: row.updated_at ? new Date(row.updated_at).getTime() : new Date(row.opened_at).getTime(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
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

  private async getBootstrapOrganizations(user: AuthUser) {
    const result = await this.db.query<OrganizationBootstrapRow>(
      `
      SELECT organization_id, organization_code, organization_name, organization_type, is_active, created_at
      FROM organizations
      WHERE tenant_id = $1
        AND is_active = true
      ORDER BY organization_name ASC
      `,
      [user.tenantId],
    );
    return result.rows.map((row) => ({
      organizationId: row.organization_id,
      organizationCode: row.organization_code,
      organizationName: row.organization_name,
      organizationType: row.organization_type,
      isActive: row.is_active,
      updatedAt: row.created_at ? row.created_at.toISOString() : null,
    }));
  }

  private async getBootstrapInsurancePlans(user: AuthUser) {
    const result = await this.db.query<InsurancePlanBootstrapRow>(
      `
      SELECT
        ip.plan_id,
        ip.organization_id,
        ip.plan_code,
        ip.plan_name,
        ip.coverage_percent,
        ip.patient_copay_percent,
        ip.monthly_limit,
        ip.annual_limit,
        ip.requires_authorization,
        ip.is_active,
        NULL::timestamp AS created_at
      FROM insurance_plans ip
      JOIN organizations o ON o.organization_id = ip.organization_id AND o.tenant_id = $1
      WHERE ip.is_active = true
        AND o.is_active = true
      ORDER BY ip.plan_name ASC
      `,
      [user.tenantId],
    );
    return result.rows.map((row) => ({
      planId: row.plan_id,
      organizationId: row.organization_id,
      planCode: row.plan_code,
      planName: row.plan_name,
      coveragePercent: Number(row.coverage_percent),
      patientCopayPercent: Number(row.patient_copay_percent),
      monthlyLimit: row.monthly_limit === null ? null : Number(row.monthly_limit),
      annualLimit: row.annual_limit === null ? null : Number(row.annual_limit),
      requiresAuthorization: row.requires_authorization,
      isActive: row.is_active,
      updatedAt: row.created_at ? row.created_at.toISOString() : null,
    }));
  }

  private async getBootstrapMemberships(user: AuthUser) {
    const result = await this.db.query<MembershipBootstrapRow>(
      `
      SELECT
        cm.membership_id,
        cm.customer_id,
        c.customer_name,
        cm.organization_id,
        o.organization_name,
        cm.plan_id,
        ip.plan_name,
        ip.coverage_percent,
        cm.member_number,
        cm.employee_number,
        cm.relationship_type,
        cm.valid_from,
        cm.valid_to,
        cm.is_active,
        NULL::timestamp AS created_at
      FROM customer_memberships cm
      JOIN customers c ON c.customer_id = cm.customer_id AND c.tenant_id = cm.tenant_id
      JOIN organizations o ON o.organization_id = cm.organization_id AND o.tenant_id = cm.tenant_id
      LEFT JOIN insurance_plans ip ON ip.plan_id = cm.plan_id AND ip.organization_id = cm.organization_id
      WHERE cm.tenant_id = $1
        AND cm.is_active = true
        AND c.is_active = true
        AND o.is_active = true
        AND (cm.valid_from IS NULL OR cm.valid_from <= CURRENT_DATE)
        AND (cm.valid_to IS NULL OR cm.valid_to >= CURRENT_DATE)
      ORDER BY c.customer_name ASC, o.organization_name ASC, ip.plan_name ASC NULLS LAST
      `,
      [user.tenantId],
    );
    return result.rows.map((row) => ({
      membershipId: row.membership_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      planId: row.plan_id,
      planName: row.plan_name,
      coveragePercent: row.coverage_percent === null ? null : Number(row.coverage_percent),
      memberNumber: row.member_number,
      employeeNumber: row.employee_number,
      relationshipType: row.relationship_type,
      validFrom: row.valid_from,
      validTo: row.valid_to,
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

  private async getOrganizationChanges(user: AuthUser, since: Date | null) {
    const result = await this.db.query<TimestampedOrganizationChange>(
      `
      SELECT
        organization_id,
        organization_code,
        organization_name,
        organization_type,
        is_active,
        created_at,
        CASE WHEN is_active THEN 'UPSERT' ELSE 'DEACTIVATE' END AS operation,
        created_at AS changed_at
      FROM organizations
      WHERE tenant_id = $1
        AND ($2::timestamptz IS NULL OR created_at > $2::timestamptz)
      ORDER BY created_at ASC, organization_name ASC
      LIMIT 100
      `,
      [user.tenantId, since ? since.toISOString() : null],
    );
    return result.rows.map((row) => ({
      operation: row.operation,
      organizationId: row.organization_id,
      organizationCode: row.organization_code,
      organizationName: row.organization_name,
      organizationType: row.organization_type,
      isActive: row.is_active,
      updatedAt: row.changed_at ? row.changed_at.toISOString() : null,
    }));
  }

  private async getInsurancePlanChanges(user: AuthUser, since: Date | null) {
    const result = await this.db.query<TimestampedInsurancePlanChange>(
      `
      SELECT
        plan_id,
        organization_id,
        plan_code,
        plan_name,
        coverage_percent,
        patient_copay_percent,
        monthly_limit,
        annual_limit,
        requires_authorization,
        is_active,
        NULL::timestamp AS created_at,
        CASE WHEN is_active THEN 'UPSERT' ELSE 'DEACTIVATE' END AS operation,
        NULL::timestamp AS changed_at
      FROM insurance_plans
      WHERE tenant_id = $1
      ORDER BY created_at ASC, plan_name ASC
      LIMIT 200
      `,
      [user.tenantId],
    );
    return result.rows.map((row) => ({
      operation: row.operation,
      planId: row.plan_id,
      organizationId: row.organization_id,
      planCode: row.plan_code,
      planName: row.plan_name,
      coveragePercent: Number(row.coverage_percent ?? 0),
      patientCopayPercent: Number(row.patient_copay_percent ?? 0),
      monthlyLimit: row.monthly_limit === null ? null : Number(row.monthly_limit),
      annualLimit: row.annual_limit === null ? null : Number(row.annual_limit),
      requiresAuthorization: row.requires_authorization,
      isActive: row.is_active,
      updatedAt: row.changed_at ? row.changed_at.toISOString() : null,
    }));
  }

  private async getMembershipChanges(user: AuthUser, since: Date | null) {
    const result = await this.db.query<TimestampedMembershipChange>(
      `
      SELECT
        cm.membership_id,
        cm.customer_id,
        c.customer_name,
        cm.organization_id,
        o.organization_name,
        cm.plan_id,
        ip.plan_name,
        ip.coverage_percent,
        cm.member_number,
        cm.employee_number,
        cm.relationship_type,
        cm.valid_from::text AS valid_from,
        cm.valid_to::text AS valid_to,
        cm.is_active,
        NULL::timestamp AS created_at,
        CASE WHEN cm.is_active THEN 'UPSERT' ELSE 'DEACTIVATE' END AS operation,
        NULL::timestamp AS changed_at
      FROM customer_memberships cm
      JOIN customers c ON c.customer_id = cm.customer_id AND c.tenant_id = cm.tenant_id
      JOIN organizations o ON o.organization_id = cm.organization_id AND o.tenant_id = cm.tenant_id
      LEFT JOIN insurance_plans ip ON ip.plan_id = cm.plan_id AND ip.organization_id = cm.organization_id
      WHERE cm.tenant_id = $1
      ORDER BY created_at ASC, cm.membership_id ASC
      LIMIT 300
      `,
      [user.tenantId],
    );
    return result.rows.map((row) => ({
      operation: row.operation,
      membershipId: row.membership_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      planId: row.plan_id,
      planName: row.plan_name,
      coveragePercent: row.coverage_percent === null ? null : Number(row.coverage_percent),
      memberNumber: row.member_number,
      employeeNumber: row.employee_number,
      relationshipType: row.relationship_type,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      isActive: row.is_active,
      updatedAt: row.changed_at ? row.changed_at.toISOString() : null,
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

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferConflictSeverity(conflictCode: string): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (['LOT_BLOCKED_AFTER_OFFLINE_SALE', 'LOT_EXPIRED_AT_OFFLINE_SALE', 'STOCK_RECONCILIATION_REQUIRED'].includes(conflictCode)) {
    return 'CRITICAL';
  }
  if (['ALLOCATION_MISMATCH', 'ALLOCATION_REVOKED', 'CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE'].includes(conflictCode)) {
    return 'WARNING';
  }
  return 'INFO';
}
