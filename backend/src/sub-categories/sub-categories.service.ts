import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import { SubCategoriesRepository } from './sub-categories.repository';

@Injectable()
export class SubCategoriesService {
  constructor(private readonly repository: SubCategoriesRepository) {}

  findAll(user: AuthUser) { return this.repository.findAll(user); }

  async findOne(user: AuthUser, id: string) {
    const found = await this.repository.findOne(user, id);
    if (!found) throw new NotFoundException('SUB_CATEGORY_NOT_FOUND');
    return found;
  }

  async create(user: AuthUser, dto: CreateSubCategoryDto) {
    try { return await this.repository.create(user, dto); } catch (error) { this.handle(error); }
  }

  async update(user: AuthUser, id: string, dto: UpdateSubCategoryDto) {
    try {
      const updated = await this.repository.update(user, id, dto);
      if (!updated) throw new NotFoundException('SUB_CATEGORY_NOT_FOUND');
      return updated;
    } catch (error) { this.handle(error); }
  }

  async remove(user: AuthUser, id: string) {
    const removed = await this.repository.remove(user, id);
    if (!removed) throw new NotFoundException('SUB_CATEGORY_NOT_FOUND');
    return removed;
  }

  private handle(error: unknown): never {
    if (error instanceof Error && error.message === 'CATEGORY_NOT_IN_TENANT') {
      throw new BadRequestException('CATEGORY_NOT_IN_TENANT');
    }
    throw error;
  }
}
