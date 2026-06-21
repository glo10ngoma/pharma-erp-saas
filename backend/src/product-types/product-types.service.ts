import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { ProductTypesRepository } from './product-types.repository';

@Injectable()
export class ProductTypesService {
  constructor(private readonly repository: ProductTypesRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  async findOne(user: AuthUser, id: string) { const found = await this.repository.findOne(user, id); if (!found) throw new NotFoundException('PRODUCT_TYPE_NOT_FOUND'); return found; }
  create(user: AuthUser, dto: CreateProductTypeDto) { return this.repository.create(user, dto); }
  async update(user: AuthUser, id: string, dto: UpdateProductTypeDto) { const updated = await this.repository.update(user, id, dto); if (!updated) throw new NotFoundException('PRODUCT_TYPE_NOT_FOUND'); return updated; }
  async remove(user: AuthUser, id: string) { const removed = await this.repository.remove(user, id); if (!removed) throw new NotFoundException('PRODUCT_TYPE_NOT_FOUND'); return removed; }
}
