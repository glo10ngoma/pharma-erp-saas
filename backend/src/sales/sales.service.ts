import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AddSaleItemFefoDto } from './dto/add-sale-item-fefo.dto';
import { ApplyInsuranceDto } from './dto/apply-insurance.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ValidateSaleDto } from './dto/validate-sale.dto';
import { SalesRepository } from './sales.repository';

@Injectable()
export class SalesService {
  constructor(private readonly repository: SalesRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  async findOne(user: AuthUser, id: string) { const sale = await this.repository.findOne(user, id); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }
  async create(user: AuthUser, dto: CreateSaleDto) { return this.wrap(() => this.repository.create(user, dto)); }
  async addItemFefo(user: AuthUser, id: string, dto: AddSaleItemFefoDto) { return this.wrap(async () => { const sale = await this.repository.addItemFefo(user, id, dto); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async applyInsurance(user: AuthUser, id: string, dto: ApplyInsuranceDto) { return this.wrap(async () => { const sale = await this.repository.applyInsurance(user, id, dto); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async removeItem(user: AuthUser, id: string, itemId: string) { return this.wrap(async () => { const sale = await this.repository.removeItem(user, id, itemId); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async validate(user: AuthUser, id: string, dto: ValidateSaleDto) { return this.wrap(() => this.repository.validate(user, id, dto)); }
  async cancel(user: AuthUser, id: string) { return this.wrap(async () => { const sale = await this.repository.cancel(user, id); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  private async wrap<T>(callback: () => Promise<T>) { try { return await callback(); } catch (error) { if (error instanceof Error) { const bad = ['SALE_NOT_DRAFT','STOCK_INSUFFICIENT','LOT_EXPIRED','LOT_BLOCKED','SALE_HAS_NO_ITEMS','PAYMENT_INSUFFICIENT','SITE_NOT_IN_TENANT','SITE_NOT_ALLOWED','CURRENCY_NOT_FOUND','CUSTOMER_NOT_IN_TENANT','ARTICLE_NOT_IN_TENANT','PAYMENT_METHOD_NOT_FOUND','CUSTOMER_REQUIRED_FOR_INSURANCE','MEMBERSHIP_NOT_ACTIVE','INSURANCE_PLAN_NOT_ACTIVE']; if (bad.includes(error.message)) throw new BadRequestException(error.message); if (error.message === 'SALE_NOT_FOUND') throw new NotFoundException('SALE_NOT_FOUND'); } throw error; } }
}
