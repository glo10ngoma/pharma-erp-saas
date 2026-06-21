import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  findAll() {
    return this.repository.findAll();
  }

  async findOne(permissionId: string) {
    const permission = await this.repository.findOne(permissionId);
    if (!permission) throw new NotFoundException('PERMISSION_NOT_FOUND');
    return permission;
  }

  create(dto: CreatePermissionDto) {
    return this.repository.create(dto);
  }

  async update(permissionId: string, dto: UpdatePermissionDto) {
    const permission = await this.repository.update(permissionId, dto);
    if (!permission) throw new NotFoundException('PERMISSION_NOT_FOUND');
    return permission;
  }

  async remove(permissionId: string) {
    const permission = await this.repository.remove(permissionId);
    if (!permission) throw new NotFoundException('PERMISSION_NOT_FOUND');
    return permission;
  }
}
