import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  findAll(user: AuthUser) {
    return this.repository.findAll(user);
  }

  async findOne(user: AuthUser, id: string) {
    const found = await this.repository.findOne(user, id);
    if (!found) throw new NotFoundException('CATEGORY_NOT_FOUND');
    return found;
  }

  create(user: AuthUser, dto: CreateCategoryDto) {
    return this.repository.create(user, dto);
  }

  async update(user: AuthUser, id: string, dto: UpdateCategoryDto) {
    const updated = await this.repository.update(user, id, dto);
    if (!updated) throw new NotFoundException('CATEGORY_NOT_FOUND');
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    const removed = await this.repository.remove(user, id);
    if (!removed) throw new NotFoundException('CATEGORY_NOT_FOUND');
    return removed;
  }
}
