import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

type RoleRow = {
  role_id: string;
  tenant_id: string;
  role_name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  permissions: string[] | null;
};

@Injectable()
export class RolesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<RoleRow>(
      `
      SELECT
        r.role_id,
        r.tenant_id,
        r.role_name,
        r.description,
        r.is_active,
        r.created_at,
        COALESCE(array_agg(p.permission_code ORDER BY p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') AS permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE r.tenant_id = $1
      GROUP BY r.role_id
      ORDER BY r.role_name ASC
      `,
      [user.tenantId],
    );

    return result.rows.map(this.toRole);
  }

  async findOne(user: AuthUser, roleId: string) {
    const result = await this.db.query<RoleRow>(
      `
      SELECT
        r.role_id,
        r.tenant_id,
        r.role_name,
        r.description,
        r.is_active,
        r.created_at,
        COALESCE(array_agg(p.permission_code ORDER BY p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') AS permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE r.tenant_id = $1 AND r.role_id = $2
      GROUP BY r.role_id
      LIMIT 1
      `,
      [user.tenantId, roleId],
    );

    return result.rows[0] ? this.toRole(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateRoleDto) {
    const roleId = await this.db.transaction(async (client) => {
      const created = await client.query<RoleRow>(
        `
        INSERT INTO roles (tenant_id, role_name, description, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING role_id, tenant_id, role_name, description, is_active, created_at, '{}'::text[] AS permissions
        `,
        [user.tenantId, dto.roleName, dto.description ?? null, dto.isActive ?? true],
      );

      const createdRoleId = created.rows[0].role_id;
      if (dto.permissionIds?.length) {
        await this.replacePermissions(client, createdRoleId, dto.permissionIds);
      }

      return createdRoleId;
    });

    return this.findOne(user, roleId);
  }

  async update(user: AuthUser, roleId: string, dto: UpdateRoleDto) {
    const current = await this.findOne(user, roleId);
    if (!current) return null;

    await this.db.transaction(async (client) => {
      await client.query(
        `
        UPDATE roles
        SET role_name = $3, description = $4, is_active = $5
        WHERE tenant_id = $1 AND role_id = $2
        `,
        [
          user.tenantId,
          roleId,
          dto.roleName ?? current.roleName,
          dto.description ?? current.description,
          dto.isActive ?? current.isActive,
        ],
      );

      if (dto.permissionIds) {
        await this.replacePermissions(client, roleId, dto.permissionIds);
      }
    });

    return this.findOne(user, roleId);
  }

  async assignPermissions(user: AuthUser, roleId: string, dto: AssignRolePermissionsDto) {
    const current = await this.findOne(user, roleId);
    if (!current) return null;

    await this.db.transaction(async (client) => {
      await this.replacePermissions(client, roleId, dto.permissionIds);
    });

    return this.findOne(user, roleId);
  }

  async remove(user: AuthUser, roleId: string) {
    const result = await this.db.query<RoleRow>(
      `
      UPDATE roles
      SET is_active = false
      WHERE tenant_id = $1 AND role_id = $2
      RETURNING role_id, tenant_id, role_name, description, is_active, created_at, '{}'::text[] AS permissions
      `,
      [user.tenantId, roleId],
    );

    return result.rows[0] ? this.toRole(result.rows[0]) : null;
  }

  private async replacePermissions(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
    roleId: string,
    permissionIds: string[],
  ) {
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    if (!permissionIds.length) return;

    const uniquePermissionIds = [...new Set(permissionIds)];
    const found = await client.query(
      `
      SELECT COUNT(*)::int AS total
      FROM permissions
      WHERE permission_id = ANY($1::uuid[])
      `,
      [uniquePermissionIds],
    );
    const total = Number((found.rows[0] as { total: number }).total);

    if (total !== uniquePermissionIds.length) {
      throw new Error('PERMISSION_NOT_FOUND');
    }

    await client.query(
      `
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT $1, p.permission_id
      FROM permissions p
      WHERE p.permission_id = ANY($2::uuid[])
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [roleId, uniquePermissionIds],
    );
  }

  private toRole(row: RoleRow) {
    return {
      roleId: row.role_id,
      tenantId: row.tenant_id,
      roleName: row.role_name,
      description: row.description,
      isActive: row.is_active,
      permissions: row.permissions ?? [],
      createdAt: row.created_at,
    };
  }
}
