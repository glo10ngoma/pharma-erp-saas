import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type UserRow = {
  user_id: string;
  tenant_id: string;
  site_id: string | null;
  role_id: string | null;
  full_name: string;
  username: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  role_name: string | null;
  site_name: string | null;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<UserRow>(
      `
      SELECT
        u.user_id,
        u.tenant_id,
        u.site_id,
        u.role_id,
        u.full_name,
        u.username,
        u.email,
        u.phone,
        u.is_active,
        u.last_login_at,
        u.created_at,
        r.role_name,
        s.site_name
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id AND r.tenant_id = u.tenant_id
      LEFT JOIN sites s ON s.site_id = u.site_id AND s.tenant_id = u.tenant_id
      WHERE u.tenant_id = $1
        AND ($2::uuid IS NULL OR u.site_id = $2::uuid)
      ORDER BY u.full_name ASC
      `,
      [user.tenantId, user.siteId ?? null],
    );

    return result.rows.map(this.toUser);
  }

  async findOne(user: AuthUser, userId: string) {
    const result = await this.db.query<UserRow>(
      `
      SELECT
        u.user_id,
        u.tenant_id,
        u.site_id,
        u.role_id,
        u.full_name,
        u.username,
        u.email,
        u.phone,
        u.is_active,
        u.last_login_at,
        u.created_at,
        r.role_name,
        s.site_name
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id AND r.tenant_id = u.tenant_id
      LEFT JOIN sites s ON s.site_id = u.site_id AND s.tenant_id = u.tenant_id
      WHERE u.tenant_id = $1 AND u.user_id = $2
        AND ($3::uuid IS NULL OR u.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, userId, user.siteId ?? null],
    );

    return result.rows[0] ? this.toUser(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    await this.assertTenantRelations(user, dto.roleId, dto.siteId);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.db.query<UserRow>(
      `
      INSERT INTO users (
        tenant_id, site_id, role_id, full_name, username, email, phone, password_hash, is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING
        user_id,
        tenant_id,
        site_id,
        role_id,
        full_name,
        username,
        email,
        phone,
        is_active,
        last_login_at,
        created_at,
        NULL::text AS role_name,
        NULL::text AS site_name
      `,
      [
        user.tenantId,
        dto.siteId,
        dto.roleId,
        dto.fullName,
        dto.username,
        dto.email ?? null,
        dto.phone ?? null,
        passwordHash,
        dto.isActive ?? true,
      ],
    );

    return this.findOne(user, result.rows[0].user_id);
  }

  async update(user: AuthUser, userId: string, dto: UpdateUserDto) {
    const current = await this.findOne(user, userId);
    if (!current) return null;

    const roleId = dto.roleId ?? current.roleId;
    const siteId = dto.siteId ?? current.siteId;
    if (roleId && siteId) await this.assertTenantRelations(user, roleId, siteId);

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    await this.db.query(
      `
      UPDATE users
      SET
        site_id = $3,
        role_id = $4,
        full_name = $5,
        username = $6,
        email = $7,
        phone = $8,
        password_hash = COALESCE($9, password_hash),
        is_active = $10
      WHERE tenant_id = $1 AND user_id = $2
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      `,
      [
        user.tenantId,
        userId,
        siteId,
        roleId,
        dto.fullName ?? current.fullName,
        dto.username ?? current.username,
        dto.email ?? current.email,
        dto.phone ?? current.phone,
        passwordHash,
        dto.isActive ?? current.isActive,
      ],
    );

    return this.findOne(user, userId);
  }

  async remove(user: AuthUser, userId: string) {
    const result = await this.db.query<UserRow>(
      `
      UPDATE users
      SET is_active = false
      WHERE tenant_id = $1 AND user_id = $2
      RETURNING
        user_id,
        tenant_id,
        site_id,
        role_id,
        full_name,
        username,
        email,
        phone,
        is_active,
        last_login_at,
        created_at,
        NULL::text AS role_name,
        NULL::text AS site_name
      `,
      [user.tenantId, userId, user.siteId ?? null],
    );

    return result.rows[0] ? this.findOne(user, result.rows[0].user_id) : null;
  }

  private async assertTenantRelations(user: AuthUser, roleId: string, siteId: string) {
    if (user.siteId && user.siteId !== siteId) {
      throw new Error('SITE_NOT_ALLOWED');
    }

    const result = await this.db.query<{ roles_count: string; sites_count: string }>(
      `
      SELECT
        (SELECT COUNT(*) FROM roles WHERE tenant_id = $1 AND role_id = $2 AND is_active = true)::int AS roles_count,
        (SELECT COUNT(*) FROM sites WHERE tenant_id = $1 AND site_id = $3 AND is_active = true)::int AS sites_count
      `,
      [user.tenantId, roleId, siteId],
    );

    if (Number(result.rows[0]?.roles_count ?? 0) !== 1) {
      throw new Error('ROLE_NOT_IN_TENANT');
    }

    if (Number(result.rows[0]?.sites_count ?? 0) !== 1) {
      throw new Error('SITE_NOT_IN_TENANT');
    }
  }

  private toUser(row: UserRow) {
    return {
      userId: row.user_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      roleId: row.role_id,
      fullName: row.full_name,
      username: row.username,
      email: row.email,
      phone: row.phone,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      roleName: row.role_name,
      siteName: row.site_name,
    };
  }
}
