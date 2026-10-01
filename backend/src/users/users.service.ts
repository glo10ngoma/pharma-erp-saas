import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  findAll(user: AuthUser) {
    return this.repository.findAll(user);
  }

  async findOne(user: AuthUser, userId: string) {
    const found = await this.repository.findOne(user, userId);
    if (!found) throw new NotFoundException('USER_NOT_FOUND');
    return found;
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    try {
      return await this.repository.create(user, dto);
    } catch (error) {
      this.handleRelationError(error);
    }
  }

  async update(user: AuthUser, userId: string, dto: UpdateUserDto) {
    try {
      if (dto.isActive === false) {
        const current = await this.repository.findOne(user, userId);
        if (!current) throw new NotFoundException('USER_NOT_FOUND');
        await this.assertUserCanBeDeactivated(user, current);
      }

      const updated = await this.repository.update(user, userId, dto);
      if (!updated) throw new NotFoundException('USER_NOT_FOUND');
      return updated;
    } catch (error) {
      this.handleRelationError(error);
    }
  }

  async remove(user: AuthUser, userId: string) {
    const current = await this.repository.findOne(user, userId);
    if (!current) throw new NotFoundException('USER_NOT_FOUND');
    await this.assertUserCanBeDeactivated(user, current);

    const removed = await this.repository.remove(user, userId);
    if (!removed) throw new NotFoundException('USER_NOT_FOUND');
    return removed;
  }

  private async assertUserCanBeDeactivated(
    actingUser: AuthUser,
    targetUser: { userId: string; roleName: string | null; isActive: boolean },
  ) {
    if (!targetUser.isActive) return;

    if (targetUser.userId === actingUser.userId) {
      throw new BadRequestException('SELF_DEACTIVATION_FORBIDDEN');
    }

    if (targetUser.roleName?.toUpperCase() !== 'ADMIN') return;

    const remainingAdmins = await this.repository.countActiveAdmins(actingUser, targetUser.userId);
    if (remainingAdmins < 1) {
      throw new BadRequestException('LAST_ADMIN_REQUIRED');
    }
  }

  private handleRelationError(error: unknown): never {
    if (error instanceof Error && error.message === 'ROLE_NOT_IN_TENANT') {
      throw new BadRequestException('ROLE_NOT_IN_TENANT');
    }

    if (error instanceof Error && error.message === 'SITE_NOT_IN_TENANT') {
      throw new BadRequestException('SITE_NOT_IN_TENANT');
    }

    if (error instanceof Error && error.message === 'SITE_NOT_ALLOWED') {
      throw new ForbiddenException('SITE_NOT_ALLOWED');
    }

    throw error;
  }
}
