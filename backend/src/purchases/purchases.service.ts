import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AddPurchaseItemDto } from './dto/add-purchase-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesRepository } from './purchases.repository';

@Injectable()
export class PurchasesService {
  constructor(private readonly repository: PurchasesRepository) {}
  findAll(user: AuthUser, status?: string) { return this.repository.findAll(user, status); }
  async findOne(user: AuthUser, id: string) { const found = await this.repository.findOne(user, id); if (!found) throw new NotFoundException('PURCHASE_NOT_FOUND'); return found; }
  async create(user: AuthUser, dto: CreatePurchaseDto) { return this.wrap(() => this.repository.create(user, dto)); }
  async update(user: AuthUser, id: string, dto: UpdatePurchaseDto) { return this.wrap(async () => { const updated = await this.repository.update(user, id, dto); if (!updated) throw new NotFoundException('PURCHASE_NOT_FOUND'); return updated; }); }
  async addItem(user: AuthUser, id: string, dto: AddPurchaseItemDto) { return this.wrap(async () => { const updated = await this.repository.addItem(user, id, dto); if (!updated) throw new NotFoundException('PURCHASE_NOT_FOUND'); return updated; }); }
  async removeItem(user: AuthUser, id: string, itemId: string) { return this.wrap(async () => { const updated = await this.repository.removeItem(user, id, itemId); if (!updated) throw new NotFoundException('PURCHASE_NOT_FOUND'); return updated; }); }
  async validate(user: AuthUser, id: string) { return this.wrap(() => this.repository.validate(user, id)); }
  private async wrap<T>(callback: () => Promise<T>) { try { return await callback(); } catch (error) { if (error instanceof Error) { const bad = ['PURCHASE_NOT_DRAFT','SUPPLIER_NOT_IN_TENANT','SITE_NOT_IN_TENANT','CURRENCY_NOT_FOUND','ARTICLE_NOT_IN_TENANT','PURCHASE_HAS_NO_ITEMS','INVALID_PURCHASE_QUANTITY','INVALID_LOT_NUMBER','INVALID_EXPIRY_DATE']; if (bad.includes(error.message)) throw new BadRequestException(error.message); if (error.message === 'PURCHASE_NOT_FOUND') throw new NotFoundException('PURCHASE_NOT_FOUND'); } throw error; } }
}
