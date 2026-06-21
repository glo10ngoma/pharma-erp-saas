import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(private readonly repository: CustomersRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  async findOne(user: AuthUser, id: string) { const found = await this.repository.findOne(user, id); if (!found) throw new NotFoundException('CUSTOMER_NOT_FOUND'); return found; }
  create(user: AuthUser, dto: CreateCustomerDto) { return this.repository.create(user, dto); }
  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) { const updated = await this.repository.update(user, id, dto); if (!updated) throw new NotFoundException('CUSTOMER_NOT_FOUND'); return updated; }
  async remove(user: AuthUser, id: string) { const removed = await this.repository.remove(user, id); if (!removed) throw new NotFoundException('CUSTOMER_NOT_FOUND'); return removed; }
}
