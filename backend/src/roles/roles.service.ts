import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesRepository } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly repository: RolesRepository) {}

  findAll(user: AuthUser) {
    return this.repository.findAll(user);
  }

  async findOne(user: AuthUser, roleId: string) {
    const role = await this.repository.findOne(user, roleId);
    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    return role;
  }

  async create(user: AuthUser, dto: CreateRoleDto) {
    try {
      return await this.repository.create(user, dto);
    } catch (error) {
      this.handlePermissionError(error);
    }
  }

  async update(user: AuthUser, roleId: string, dto: UpdateRoleDto) {
    try {
      if (dto.isActive === false) {
        await this.assertRoleCanBeDeactivated(user, roleId);
      }

      const role = await this.repository.update(user, roleId, dto);
      if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
      return role;
    } catch (error) {
      this.handlePermissionError(error);
    }
  }

  async assignPermissions(user: AuthUser, roleId: string, dto: AssignRolePermissionsDto) {
    try {
      const role = await this.repository.assignPermissions(user, roleId, dto);
      if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
      return role;
    } catch (error) {
      this.handlePermissionError(error);
    }
  }

  async remove(user: AuthUser, roleId: string) {
    await this.assertRoleCanBeDeactivated(user, roleId);

    const role = await this.repository.remove(user, roleId);
    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');
    return role;
  }

  private async assertRoleCanBeDeactivated(user: AuthUser, roleId: string) {
    const role = await this.repository.findOne(user, roleId);
    if (!role) throw new NotFoundException('ROLE_NOT_FOUND');

    const activeUsers = await this.repository.countActiveUsersForRole(user, roleId);
    if (activeUsers > 0) {
      throw new BadRequestException('ROLE_IN_USE');
    }
  }

  private handlePermissionError(error: unknown): never {
    if (error instanceof Error && error.message === 'PERMISSION_NOT_FOUND') {
      throw new BadRequestException('PERMISSION_NOT_FOUND');
    }

    throw error;
  }
}
