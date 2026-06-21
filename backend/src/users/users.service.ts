import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      const updated = await this.repository.update(user, userId, dto);
      if (!updated) throw new NotFoundException('USER_NOT_FOUND');
      return updated;
    } catch (error) {
      this.handleRelationError(error);
    }
  }

  async remove(user: AuthUser, userId: string) {
    const removed = await this.repository.remove(user, userId);
    if (!removed) throw new NotFoundException('USER_NOT_FOUND');
    return removed;
  }

  private handleRelationError(error: unknown): never {
    if (error instanceof Error && error.message === 'ROLE_NOT_IN_TENANT') {
      throw new BadRequestException('ROLE_NOT_IN_TENANT');
    }

    if (error instanceof Error && error.message === 'SITE_NOT_IN_TENANT') {
      throw new BadRequestException('SITE_NOT_IN_TENANT');
    }

    throw error;
  }
}
