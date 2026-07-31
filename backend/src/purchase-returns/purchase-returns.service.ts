import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { PurchaseAttachmentsService } from '../purchases/purchase-attachments.service';
import { AddPurchaseReturnItemDto } from './dto/add-purchase-return-item.dto';
import { AddPurchaseReturnReplacementItemDto } from './dto/add-purchase-return-replacement-item.dto';
import { AddPurchaseReturnSettlementDto } from './dto/add-purchase-return-settlement.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { PurchaseReturnsRepository } from './purchase-returns.repository';

@Injectable()
export class PurchaseReturnsService {
  constructor(
    private readonly repository: PurchaseReturnsRepository,
    private readonly attachments: PurchaseAttachmentsService,
  ) {}

  findAll(user: AuthUser, purchaseId?: string) { return this.repository.findAll(user, purchaseId); }
  async findOne(user: AuthUser, id: string) { const found = await this.repository.findOne(user, id); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }
  create(user: AuthUser, dto: CreatePurchaseReturnDto) { return this.wrap(() => this.repository.create(user, dto)); }
  addItem(user: AuthUser, id: string, dto: AddPurchaseReturnItemDto) { return this.wrap(async () => { const found = await this.repository.addItem(user, id, dto); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  removeItem(user: AuthUser, id: string, itemId: string) { return this.wrap(async () => { const found = await this.repository.removeItem(user, id, itemId); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  addReplacementItem(user: AuthUser, id: string, dto: AddPurchaseReturnReplacementItemDto) { return this.wrap(async () => { const found = await this.repository.addReplacementItem(user, id, dto); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  removeReplacementItem(user: AuthUser, id: string, itemId: string) { return this.wrap(async () => { const found = await this.repository.removeReplacementItem(user, id, itemId); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  addSettlement(user: AuthUser, id: string, dto: AddPurchaseReturnSettlementDto) { return this.wrap(async () => { const found = await this.repository.addSettlement(user, id, dto); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  removeSettlement(user: AuthUser, id: string, settlementId: string) { return this.wrap(async () => { const found = await this.repository.removeSettlement(user, id, settlementId); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  validate(user: AuthUser, id: string) { return this.wrap(async () => { const found = await this.repository.validate(user, id); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  cancel(user: AuthUser, id: string) { return this.wrap(async () => { const found = await this.repository.cancel(user, id); if (!found) throw new NotFoundException('PURCHASE_RETURN_NOT_FOUND'); return found; }); }
  findSupplierCredits(user: AuthUser) { return this.repository.findSupplierCredits(user); }
  findAttachments(user: AuthUser, id: string) { return this.attachments.findForReturn(user, id); }
  uploadAttachment(user: AuthUser, id: string, file: any, dto: { attachmentType?: string; description?: string }) { return this.attachments.uploadForReturn(user, id, file, dto); }
  attachmentUrl(user: AuthUser, id: string, attachmentId: string) { return this.attachments.signedUrlForReturn(user, id, attachmentId); }
  removeAttachment(user: AuthUser, id: string, attachmentId: string) { return this.attachments.removeForReturn(user, id, attachmentId); }

  private async wrap<T>(callback: () => Promise<T>) {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        const bad = [
          'PURCHASE_NOT_FOUND',
          'PURCHASE_RETURN_NOT_FOUND',
          'PURCHASE_RETURN_NOT_DRAFT',
          'PURCHASE_RETURN_PURCHASE_NOT_VALIDATED',
          'PURCHASE_RETURN_ITEM_NOT_FOUND',
          'PURCHASE_RETURN_LOT_NOT_FOUND',
          'INVALID_RETURN_QUANTITY',
          'INVALID_REPLACEMENT_QUANTITY',
          'INVALID_SETTLEMENT_AMOUNT',
          'INVALID_LOT_NUMBER',
          'INVALID_EXPIRY_DATE',
          'EXCHANGE_RATE_REQUIRED',
          'CASH_SESSION_REQUIRED',
          'CASH_SESSION_NOT_OPEN',
          'RETURN_STOCK_NOT_FOUND',
          'RETURN_NOT_AVAILABLE',
          'RETURN_QUANTITY_EXCEEDS_AVAILABLE',
          'PURCHASE_RETURN_HAS_NO_ITEMS',
          'RETURN_SETTLEMENT_EXCEEDS_REFUND',
          'RETURN_SETTLEMENT_EXCEEDS_ADDITIONAL',
          'SUPPLIER_CREDIT_SOURCE_REQUIRED',
          'ARTICLE_NOT_IN_TENANT',
        ];
        if (bad.includes(error.message)) throw new BadRequestException(error.message);
        if (error.message === 'PERMISSION_DENIED') throw new ForbiddenException('PERMISSION_DENIED');
      }
      throw error;
    }
  }
}
