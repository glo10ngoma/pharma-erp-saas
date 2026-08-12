import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AddSaleItemFefoDto } from './dto/add-sale-item-fefo.dto';
import { ApplyInsuranceDto } from './dto/apply-insurance.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import { UpdateSaleItemDto } from './dto/update-sale-item.dto';
import { UpdateSaleDraftDto } from './dto/update-sale-draft.dto';
import { ValidateSaleDto } from './dto/validate-sale.dto';
import { SalesRepository } from './sales.repository';
import { SubmitPosSaleValidateOperation } from '../pos-sync/dto/submit-pos-operations.dto';

@Injectable()
export class SalesService {
  constructor(private readonly repository: SalesRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findList(user: AuthUser, query: ListSalesDto) { return this.repository.findList(user, query); }
  findSummary(user: AuthUser, query: ListSalesDto) { return this.repository.findSummary(user, query); }
  async findOne(user: AuthUser, id: string) { const sale = await this.repository.findOne(user, id); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }
  async create(user: AuthUser, dto: CreateSaleDto) { return this.wrap(() => this.repository.create(user, dto)); }
  async updateDraft(user: AuthUser, id: string, dto: UpdateSaleDraftDto) { return this.wrap(async () => { const sale = await this.repository.updateDraft(user, id, dto); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async addItemFefo(user: AuthUser, id: string, dto: AddSaleItemFefoDto) { return this.wrap(async () => { const sale = await this.repository.addItemFefo(user, id, dto); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async updateItem(user: AuthUser, id: string, itemId: string, dto: UpdateSaleItemDto) { return this.wrap(async () => { const sale = await this.repository.updateItem(user, id, itemId, dto); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async applyInsurance(user: AuthUser, id: string, dto: ApplyInsuranceDto) { return this.wrap(async () => { const sale = await this.repository.applyInsurance(user, id, dto); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async removeItem(user: AuthUser, id: string, itemId: string) { return this.wrap(async () => { const sale = await this.repository.removeItem(user, id, itemId); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  async validate(user: AuthUser, id: string, dto: ValidateSaleDto) { return this.wrap(() => this.repository.validate(user, id, dto)); }
  async replayOfflineValidatedSale(user: AuthUser, operation: SubmitPosSaleValidateOperation): Promise<{
    saleId: string;
    saleNumber: string | null;
    allocations: Array<{
      allocationId: string;
      lotId: string;
      acknowledgedQuantity: number;
      serverConsumedQuantity: number;
      availableQuantity: number;
      serverVersion: number;
      status: string;
    }>;
  }> { return this.wrap(() => this.repository.replayOfflineValidatedSale(user, operation)); }
  async confirmPickup(user: AuthUser, id: string, dto: ConfirmPickupDto) { return this.wrap(() => this.repository.confirmPickup(user, id, dto)); }
  async cancel(user: AuthUser, id: string) { return this.wrap(async () => { const sale = await this.repository.cancel(user, id); if (!sale) throw new NotFoundException('SALE_NOT_FOUND'); return sale; }); }
  private async wrap<T>(callback: () => Promise<T>) { try { return await callback(); } catch (error) { if (error instanceof Error) { const bad = ['SALE_NOT_DRAFT','SALE_NOT_ADVANCE','SALE_NOT_VALIDATED','SALE_ALREADY_FULFILLED','SALE_PICKUP_QUANTITY_INVALID','SALE_PICKUP_STOCK_INSUFFICIENT','SALE_PICKUP_NOT_ALLOWED','STOCK_INSUFFICIENT','LOT_EXPIRED','LOT_BLOCKED','SALE_HAS_NO_ITEMS','PAYMENT_INSUFFICIENT','SITE_NOT_IN_TENANT','SITE_NOT_ALLOWED','CURRENCY_NOT_FOUND','CUSTOMER_NOT_IN_TENANT','ARTICLE_NOT_IN_TENANT','PAYMENT_METHOD_NOT_FOUND','CUSTOMER_REQUIRED_FOR_INSURANCE','MEMBERSHIP_NOT_ACTIVE','INSURANCE_PLAN_NOT_ACTIVE','INVALID_SETTLEMENT_AMOUNT','INVALID_SETTLEMENT_RETURN','CHANGE_NOT_ALLOWED_FOR_NON_CASH','SETTLEMENT_REASON_REQUIRED','EXCHANGE_RATE_REQUIRED','SALE_ITEM_NOT_FOUND','INVALID_SALE_ITEM_QUANTITY','LOT_EXPIRY_DATE_INVALID','ALLOCATION_MISMATCH','ALLOCATION_EXHAUSTED','ALLOCATION_REVOKED','LOT_BLOCKED_AFTER_OFFLINE_SALE','LOT_EXPIRED_AT_OFFLINE_SALE','CASH_SESSION_CLOSED_AFTER_OFFLINE_SALE']; if (bad.includes(error.message)) throw new BadRequestException(error.message); if (error.message === 'SALE_NOT_FOUND') throw new NotFoundException('SALE_NOT_FOUND'); } throw error; } }
}
