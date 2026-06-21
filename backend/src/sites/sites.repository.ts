import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

type SiteRow = {
  site_id: string;
  tenant_id: string;
  site_code: string;
  site_name: string;
  site_type: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: Date;
};

@Injectable()
export class SitesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<SiteRow>(
      `
      SELECT site_id, tenant_id, site_code, site_name, site_type, address, phone, is_active, created_at
      FROM sites
      WHERE tenant_id = $1
        AND ($2::uuid IS NULL OR site_id = $2::uuid)
      ORDER BY site_name ASC
      `,
      [user.tenantId, user.siteId ?? null],
    );

    return result.rows.map(this.toSite);
  }

  async findOne(user: AuthUser, siteId: string) {
    const result = await this.db.query<SiteRow>(
      `
      SELECT site_id, tenant_id, site_code, site_name, site_type, address, phone, is_active, created_at
      FROM sites
      WHERE tenant_id = $1 AND site_id = $2
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, siteId, user.siteId ?? null],
    );

    return result.rows[0] ? this.toSite(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateSiteDto) {
    if (user.siteId) throw new Error('SITE_NOT_ALLOWED');

    const result = await this.db.query<SiteRow>(
      `
      INSERT INTO sites (tenant_id, site_code, site_name, site_type, address, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING site_id, tenant_id, site_code, site_name, site_type, address, phone, is_active, created_at
      `,
      [
        user.tenantId,
        dto.siteCode,
        dto.siteName,
        dto.siteType,
        dto.address ?? null,
        dto.phone ?? null,
        dto.isActive ?? true,
      ],
    );

    return this.toSite(result.rows[0]);
  }

  async update(user: AuthUser, siteId: string, dto: UpdateSiteDto) {
    const current = await this.findOne(user, siteId);
    if (!current) return null;

    const result = await this.db.query<SiteRow>(
      `
      UPDATE sites
      SET
        site_code = $3,
        site_name = $4,
        site_type = $5,
        address = $6,
        phone = $7,
        is_active = $8
      WHERE tenant_id = $1 AND site_id = $2
        AND ($9::uuid IS NULL OR site_id = $9::uuid)
      RETURNING site_id, tenant_id, site_code, site_name, site_type, address, phone, is_active, created_at
      `,
      [
        user.tenantId,
        siteId,
        dto.siteCode ?? current.siteCode,
        dto.siteName ?? current.siteName,
        dto.siteType ?? current.siteType,
        dto.address ?? current.address,
        dto.phone ?? current.phone,
        dto.isActive ?? current.isActive,
        user.siteId ?? null,
      ],
    );

    return result.rows[0] ? this.toSite(result.rows[0]) : null;
  }

  async remove(user: AuthUser, siteId: string) {
    const result = await this.db.query<SiteRow>(
      `
      UPDATE sites
      SET is_active = false
      WHERE tenant_id = $1 AND site_id = $2
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      RETURNING site_id, tenant_id, site_code, site_name, site_type, address, phone, is_active, created_at
      `,
      [user.tenantId, siteId, user.siteId ?? null],
    );

    return result.rows[0] ? this.toSite(result.rows[0]) : null;
  }

  private toSite(row: SiteRow) {
    return {
      siteId: row.site_id,
      tenantId: row.tenant_id,
      siteCode: row.site_code,
      siteName: row.site_name,
      siteType: row.site_type,
      address: row.address,
      phone: row.phone,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }
}
