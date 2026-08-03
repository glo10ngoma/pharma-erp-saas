import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { PurchaseAttachmentsService } from '../purchases/purchase-attachments.service';
import { SalesService } from '../sales/sales.service';
import { AddCustomerReturnItemDto } from './dto/add-customer-return-item.dto';
import { AddCustomerReturnReplacementItemDto } from './dto/add-customer-return-replacement-item.dto';
import { AddCustomerReturnSettlementDto } from './dto/add-customer-return-settlement.dto';
import { CreateCustomerReturnDto } from './dto/create-customer-return.dto';
import { InspectCustomerReturnDto } from './dto/inspect-customer-return.dto';
import { ListCustomerReturnsDto } from './dto/list-customer-returns.dto';
import { SearchValidatedSalesDto } from './dto/search-validated-sales.dto';
import { CustomerReturnsRepository, CustomerReturnSaleItem } from './customer-returns.repository';

@Injectable()
export class CustomerReturnsService {
  constructor(
    private readonly repository: CustomerReturnsRepository,
    private readonly salesService: SalesService,
    private readonly attachments: PurchaseAttachmentsService,
  ) {}

  findAll(user: AuthUser, query: ListCustomerReturnsDto) {
    return this.repository.findAll(user, query);
  }

  searchValidatedSales(user: AuthUser, query: SearchValidatedSalesDto) {
    return this.salesService.findList(user, {
      saleNumber: query.search?.trim() || undefined,
      customer: query.search?.trim() || undefined,
      siteId: query.siteId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      status: 'VALIDATED',
      sortBy: 'saleDate',
      sortOrder: 'desc',
      page: query.page,
      limit: query.limit ?? 20,
    });
  }

  async create(user: AuthUser, dto: CreateCustomerReturnDto) {
    return this.wrap(async () => {
      const sale = await this.salesService.findOne(user, dto.saleId);
      if (!sale) throw new NotFoundException('SALE_NOT_FOUND');
      if (sale.status !== 'VALIDATED') throw new BadRequestException('CUSTOMER_RETURN_SALE_NOT_VALIDATED');
      const customerReturnId = await this.repository.create(user, dto, sale);
      return this.findOne(user, customerReturnId);
    });
  }

  async findOne(user: AuthUser, id: string) {
    const found = await this.repository.findOne(user, id);
    if (!found) throw new NotFoundException('CUSTOMER_RETURN_NOT_FOUND');
    const sale = await this.salesService.findOne(user, found.saleId);
    const returnedQuantities = await this.repository.findReturnedQuantitiesBySale(user, found.saleId);
    const returnableItems = (sale.items ?? []).map((item: CustomerReturnSaleItem) => {
      const soldQuantity = Number(item.quantity ?? 0);
      const returnedQuantity = Number(returnedQuantities.get(item.saleItemId) ?? 0);
      return {
        ...item,
        soldQuantity,
        returnedQuantity,
        availableQuantity: Math.max(soldQuantity - returnedQuantity, 0),
      };
    });
    return {
      ...found,
      sale: {
        ...sale,
        returnableItems,
      },
    };
  }

  async addItem(user: AuthUser, id: string, dto: AddCustomerReturnItemDto) {
    return this.wrap(async () => {
      const current = await this.repository.findOne(user, id);
      if (!current) throw new NotFoundException('CUSTOMER_RETURN_NOT_FOUND');
      if (current.status !== 'DRAFT') throw new BadRequestException('CUSTOMER_RETURN_NOT_DRAFT');

      const sale = await this.salesService.findOne(user, current.saleId);
      const selectedItem = (sale.items ?? []).find((item: CustomerReturnSaleItem) => item.saleItemId === dto.saleItemId);
      if (!selectedItem) throw new BadRequestException('CUSTOMER_RETURN_SALE_ITEM_NOT_FOUND');

      const returnedQuantities = await this.repository.findReturnedQuantitiesBySale(user, current.saleId);
      const alreadyReturned = Number(returnedQuantities.get(dto.saleItemId) ?? 0);
      const soldQuantity = Number(selectedItem.quantity ?? 0);
      const availableQuantity = Math.max(soldQuantity - alreadyReturned, 0);
      if (availableQuantity <= 0) throw new BadRequestException('RETURN_NOT_AVAILABLE');
      if (Number(dto.returnedQuantity) > availableQuantity) throw new BadRequestException('RETURN_QUANTITY_EXCEEDS_AVAILABLE');

      await this.repository.addItem(user, id, dto, selectedItem, availableQuantity, current.saleId);
      return this.findOne(user, id);
    });
  }

  async removeItem(user: AuthUser, id: string, itemId: string) {
    return this.wrap(async () => {
      const found = await this.repository.removeItem(user, id, itemId);
      if (!found) throw new NotFoundException('CUSTOMER_RETURN_ITEM_NOT_FOUND');
      return this.findOne(user, id);
    });
  }

  async submitForInspection(user: AuthUser, id: string) {
    return this.wrap(() => this.repository.submitForInspection(user, id));
  }

  async inspect(user: AuthUser, id: string, dto: InspectCustomerReturnDto) {
    return this.wrap(() => this.repository.inspect(user, id, dto));
  }

  async validate(user: AuthUser, id: string) {
    return this.wrap(() => this.repository.validate(user, id));
  }

  async cancel(user: AuthUser, id: string) {
    return this.wrap(() => this.repository.cancel(user, id));
  }

  findAttachments(user: AuthUser, id: string) {
    return this.attachments.findForCustomerReturn(user, id);
  }

  findCustomerCredits(user: AuthUser, customerId?: string) {
    return this.repository.findCustomerCredits(user, customerId);
  }

  uploadAttachment(user: AuthUser, id: string, file: any, dto: { attachmentType?: string; description?: string }) {
    return this.attachments.uploadForCustomerReturn(user, id, file, dto);
  }

  attachmentUrl(user: AuthUser, id: string, attachmentId: string) {
    return this.attachments.signedUrlForCustomerReturn(user, id, attachmentId);
  }

  removeAttachment(user: AuthUser, id: string, attachmentId: string) {
    return this.attachments.removeForCustomerReturn(user, id, attachmentId);
  }

  async addReplacementItem(user: AuthUser, id: string, dto: AddCustomerReturnReplacementItemDto) {
    return this.wrap(async () => {
      await this.repository.addReplacementItem(user, id, dto);
      return this.findOne(user, id);
    });
  }

  async removeReplacementItem(user: AuthUser, id: string, itemId: string) {
    return this.wrap(async () => {
      await this.repository.removeReplacementItem(user, id, itemId);
      return this.findOne(user, id);
    });
  }

  async addSettlement(user: AuthUser, id: string, dto: AddCustomerReturnSettlementDto) {
    return this.wrap(async () => {
      if (dto.settlementKind === 'CUSTOMER_CREDIT') {
        if (!user.permissions.includes('customer_returns.credit') && !user.permissions.includes('customer_credits.create')) {
          throw new ForbiddenException('PERMISSION_DENIED');
        }
      } else if (!user.permissions.includes('customer_returns.refund')) {
        throw new ForbiddenException('PERMISSION_DENIED');
      }
      await this.repository.addSettlement(user, id, dto);
      return this.findOne(user, id);
    });
  }

  async removeSettlement(user: AuthUser, id: string, settlementId: string) {
    return this.wrap(async () => {
      const current = await this.findOne(user, id);
      const settlement = current.settlements?.find((entry) => entry.customerReturnSettlementId === settlementId);
      if (!settlement) throw new NotFoundException('CUSTOMER_RETURN_ITEM_NOT_FOUND');
      if (settlement.settlementKind === 'CUSTOMER_CREDIT') {
        if (!user.permissions.includes('customer_returns.credit') && !user.permissions.includes('customer_credits.create')) {
          throw new ForbiddenException('PERMISSION_DENIED');
        }
      } else if (!user.permissions.includes('customer_returns.refund')) {
        throw new ForbiddenException('PERMISSION_DENIED');
      }
      await this.repository.removeSettlement(user, id, settlementId);
      return this.findOne(user, id);
    });
  }

  private async wrap<T>(callback: () => Promise<T>) {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      if (error instanceof Error) {
        const bad = [
          'CUSTOMER_RETURN_NOT_FOUND',
          'CUSTOMER_RETURN_NOT_DRAFT',
          'CUSTOMER_RETURN_NOT_PENDING_INSPECTION',
          'CUSTOMER_RETURN_NOT_APPROVED',
          'CUSTOMER_RETURN_SALE_NOT_VALIDATED',
          'CUSTOMER_RETURN_ITEM_NOT_FOUND',
          'CUSTOMER_RETURN_ITEM_ALREADY_EXISTS',
          'CUSTOMER_RETURN_SALE_ITEM_NOT_FOUND',
          'CUSTOMER_RETURN_EMPTY',
          'CUSTOMER_RETURN_ALREADY_VALIDATED',
          'CUSTOMER_RETURN_SALE_MISMATCH',
          'CUSTOMER_RETURN_SETTLEMENT_REQUIRED',
          'CUSTOMER_REQUIRED_FOR_CREDIT',
          'CUSTOMER_CREDIT_SOURCE_REQUIRED',
          'RETURN_NOT_AVAILABLE',
          'RETURN_QUANTITY_EXCEEDS_AVAILABLE',
          'INVALID_SETTLEMENT_AMOUNT',
          'EXCHANGE_RATE_REQUIRED',
          'CASH_SESSION_REQUIRED',
          'CASH_SESSION_NOT_OPEN',
          'ARTICLE_NOT_IN_TENANT',
        ];
        if (bad.includes(error.message)) throw new BadRequestException(error.message);
        if (error.message === 'PERMISSION_DENIED') throw new ForbiddenException('PERMISSION_DENIED');
      }
      throw error;
    }
  }
}
