import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

type PermissionRow = {
  permission_id: string;
  permission_code: string;
  permission_name: string;
  module_name: string;
  description: string | null;
  is_system_permission: boolean;
};

@Injectable()
export class PermissionsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const result = await this.db.query<PermissionRow>(
      `
      SELECT permission_id, permission_code, permission_name, module_name, description, is_system_permission
      FROM permissions
      ORDER BY module_name ASC, permission_code ASC
      `,
    );

    return result.rows.map(this.toPermission);
  }

  async findOne(permissionId: string) {
    const result = await this.db.query<PermissionRow>(
      `
      SELECT permission_id, permission_code, permission_name, module_name, description, is_system_permission
      FROM permissions
      WHERE permission_id = $1
      LIMIT 1
      `,
      [permissionId],
    );

    return result.rows[0] ? this.toPermission(result.rows[0]) : null;
  }

  async create(dto: CreatePermissionDto) {
    const result = await this.db.query<PermissionRow>(
      `
      INSERT INTO permissions (
        permission_code, permission_name, module_name, description, is_system_permission
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING permission_id, permission_code, permission_name, module_name, description, is_system_permission
      `,
      [
        dto.permissionCode,
        dto.permissionName,
        dto.moduleName,
        dto.description ?? null,
        dto.isSystemPermission ?? false,
      ],
    );

    return this.toPermission(result.rows[0]);
  }

  async update(permissionId: string, dto: UpdatePermissionDto) {
    const current = await this.findOne(permissionId);
    if (!current) return null;

    const result = await this.db.query<PermissionRow>(
      `
      UPDATE permissions
      SET
        permission_code = $2,
        permission_name = $3,
        module_name = $4,
        description = $5,
        is_system_permission = $6
      WHERE permission_id = $1
      RETURNING permission_id, permission_code, permission_name, module_name, description, is_system_permission
      `,
      [
        permissionId,
        dto.permissionCode ?? current.permissionCode,
        dto.permissionName ?? current.permissionName,
        dto.moduleName ?? current.moduleName,
        dto.description ?? current.description,
        dto.isSystemPermission ?? current.isSystemPermission,
      ],
    );

    return result.rows[0] ? this.toPermission(result.rows[0]) : null;
  }

  async remove(permissionId: string) {
    const result = await this.db.query<PermissionRow>(
      `
      DELETE FROM permissions
      WHERE permission_id = $1
      RETURNING permission_id, permission_code, permission_name, module_name, description, is_system_permission
      `,
      [permissionId],
    );

    return result.rows[0] ? this.toPermission(result.rows[0]) : null;
  }

  private toPermission(row: PermissionRow) {
    return {
      permissionId: row.permission_id,
      permissionCode: row.permission_code,
      permissionName: row.permission_name,
      moduleName: row.module_name,
      description: row.description,
      isSystemPermission: row.is_system_permission,
    };
  }
}
