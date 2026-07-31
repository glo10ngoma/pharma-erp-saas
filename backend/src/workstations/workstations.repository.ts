import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateWorkstationDto } from './dto/create-workstation.dto';
import { UpdateWorkstationDto } from './dto/update-workstation.dto';

type WorkstationRow = {
  workstation_id: string;
  tenant_id: string;
  site_id: string | null;
  site_name: string | null;
  workstation_code: string;
  workstation_name: string;
  workstation_type: string;
  is_active: boolean;
  device_uuid: string | null;
  offline_status: string;
  sync_state: string;
  is_synced: boolean;
  last_sync_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class WorkstationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<WorkstationRow>(
      `
      SELECT w.workstation_id, w.tenant_id, w.site_id, s.site_name, w.workstation_code, w.workstation_name,
             w.workstation_type, w.is_active, w.device_uuid, w.offline_status, w.sync_state,
             w.is_synced, w.last_sync_at, w.created_at, w.updated_at
      FROM pos_workstations w
      LEFT JOIN sites s ON s.site_id = w.site_id AND s.tenant_id = w.tenant_id
      WHERE w.tenant_id = $1
        AND ($2::uuid IS NULL OR w.site_id = $2::uuid)
      ORDER BY COALESCE(s.site_name, ''), w.workstation_name
      `,
      [user.tenantId, user.siteId ?? null],
    );
    return result.rows.map((row) => this.toWorkstation(row));
  }

  async create(user: AuthUser, dto: CreateWorkstationDto) {
    await this.assertSiteAllowed(user, dto.siteId);
    const result = await this.db.query<{ workstation_id: string }>(
      `
      INSERT INTO pos_workstations (
        tenant_id, site_id, workstation_code, workstation_name, workstation_type, device_uuid
      )
      VALUES ($1, $2, upper($3), $4, $5, $6)
      RETURNING workstation_id
      `,
      [user.tenantId, dto.siteId, dto.workstationCode.trim(), dto.workstationName.trim(), dto.workstationType ?? 'POS', dto.deviceUuid ?? null],
    );
    await this.insertAudit(user, result.rows[0].workstation_id, 'INSERT', { workstationCode: dto.workstationCode, workstationName: dto.workstationName });
    return this.findOne(user, result.rows[0].workstation_id);
  }

  async update(user: AuthUser, id: string, dto: UpdateWorkstationDto) {
    const current = await this.findOne(user, id);
    if (!current) throw new NotFoundException('WORKSTATION_NOT_FOUND');
    const nextSiteId = dto.siteId ?? current.siteId ?? undefined;
    if (!nextSiteId) throw new BadRequestException('SITE_NOT_IN_TENANT');
    await this.assertSiteAllowed(user, nextSiteId);
    await this.db.query(
      `
      UPDATE pos_workstations
      SET site_id = $3,
          workstation_code = COALESCE($4, workstation_code),
          workstation_name = COALESCE($5, workstation_name),
          workstation_type = COALESCE($6, workstation_type),
          device_uuid = COALESCE($7, device_uuid),
          is_active = COALESCE($8, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND workstation_id = $2
      `,
      [
        user.tenantId,
        id,
        nextSiteId,
        dto.workstationCode?.trim().toUpperCase() ?? null,
        dto.workstationName?.trim() ?? null,
        dto.workstationType ?? null,
        dto.deviceUuid ?? null,
        dto.isActive ?? null,
      ],
    );
    await this.insertAudit(user, id, 'UPDATE', dto);
    return this.findOne(user, id);
  }

  async findOne(user: AuthUser, id: string) {
    const result = await this.db.query<WorkstationRow>(
      `
      SELECT w.workstation_id, w.tenant_id, w.site_id, s.site_name, w.workstation_code, w.workstation_name,
             w.workstation_type, w.is_active, w.device_uuid, w.offline_status, w.sync_state,
             w.is_synced, w.last_sync_at, w.created_at, w.updated_at
      FROM pos_workstations w
      LEFT JOIN sites s ON s.site_id = w.site_id AND s.tenant_id = w.tenant_id
      WHERE w.tenant_id = $1
        AND w.workstation_id = $2
        AND ($3::uuid IS NULL OR w.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, id, user.siteId ?? null],
    );
    return result.rows[0] ? this.toWorkstation(result.rows[0]) : null;
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

  private toWorkstation(row: WorkstationRow) {
    return {
      workstationId: row.workstation_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      workstationCode: row.workstation_code,
      workstationName: row.workstation_name,
      workstationType: row.workstation_type,
      isActive: row.is_active,
      deviceUuid: row.device_uuid,
      offlineStatus: row.offline_status,
      syncState: row.sync_state,
      isSynced: row.is_synced,
      lastSyncAt: row.last_sync_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
