import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersRepository } from './suppliers.repository';

@Injectable()
export class SuppliersService {
  constructor(private readonly repository: SuppliersRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  async findOne(user: AuthUser, id: string) { const found = await this.repository.findOne(user, id); if (!found) throw new NotFoundException('SUPPLIER_NOT_FOUND'); return found; }
  create(user: AuthUser, dto: CreateSupplierDto) { return this.repository.create(user, dto); }
  async update(user: AuthUser, id: string, dto: UpdateSupplierDto) { const updated = await this.repository.update(user, id, dto); if (!updated) throw new NotFoundException('SUPPLIER_NOT_FOUND'); return updated; }
  async remove(user: AuthUser, id: string) { const removed = await this.repository.remove(user, id); if (!removed) throw new NotFoundException('SUPPLIER_NOT_FOUND'); return removed; }
}
