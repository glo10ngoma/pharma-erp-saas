import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
const memoryStorage = require('multer').memoryStorage;
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { UploadPurchaseAttachmentDto } from '../purchases/dto/upload-purchase-attachment.dto';
import { AddPurchaseReturnItemDto } from './dto/add-purchase-return-item.dto';
import { AddPurchaseReturnReplacementItemDto } from './dto/add-purchase-return-replacement-item.dto';
import { AddPurchaseReturnSettlementDto } from './dto/add-purchase-return-settlement.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { PurchaseReturnsService } from './purchase-returns.service';

@ApiTags('purchase-returns')
@ApiBearerAuth()
@Controller('purchase-returns')
export class PurchaseReturnsController {
  constructor(private readonly service: PurchaseReturnsService) {}

  @Get('supplier-credits')
  @RequirePermission('supplier_credits.read')
  supplierCredits(@CurrentUser() user: AuthUser) { return this.service.findSupplierCredits(user); }

  @Get()
  @RequirePermission('purchase_returns.read')
  findAll(@CurrentUser() user: AuthUser, @Query('purchaseId') purchaseId?: string) { return this.service.findAll(user, purchaseId); }

  @Post()
  @RequirePermission('purchase_returns.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseReturnDto) { return this.service.create(user, dto); }

  @Get(':id')
  @RequirePermission('purchase_returns.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }

  @Post(':id/items')
  @RequirePermission('purchase_returns.create')
  addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddPurchaseReturnItemDto) { return this.service.addItem(user, id, dto); }

  @Delete(':id/items/:itemId')
  @RequirePermission('purchase_returns.create')
  removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) { return this.service.removeItem(user, id, itemId); }

  @Post(':id/replacements')
  @RequirePermission('purchase_returns.exchange')
  addReplacement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddPurchaseReturnReplacementItemDto) { return this.service.addReplacementItem(user, id, dto); }

  @Delete(':id/replacements/:itemId')
  @RequirePermission('purchase_returns.exchange')
  removeReplacement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) { return this.service.removeReplacementItem(user, id, itemId); }

  @Post(':id/settlements')
  @RequirePermission('purchase_returns.refund')
  addSettlement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddPurchaseReturnSettlementDto) { return this.service.addSettlement(user, id, dto); }

  @Delete(':id/settlements/:settlementId')
  @RequirePermission('purchase_returns.refund')
  removeSettlement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('settlementId') settlementId: string) { return this.service.removeSettlement(user, id, settlementId); }

  @Post(':id/validate')
  @RequirePermission('purchase_returns.validate')
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.validate(user, id); }

  @Post(':id/cancel')
  @RequirePermission('purchase_returns.cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.cancel(user, id); }

  @Get(':id/attachments')
  @RequirePermission('purchase_attachments.read')
  attachments(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findAttachments(user, id); }

  @Post(':id/attachments')
  @RequirePermission('purchase_attachments.create')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file: any, @Body() dto: UploadPurchaseAttachmentDto) { return this.service.uploadAttachment(user, id, file, dto); }

  @Get(':id/attachments/:attachmentId/url')
  @RequirePermission('purchase_attachments.read')
  attachmentUrl(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) { return this.service.attachmentUrl(user, id, attachmentId); }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermission('purchase_attachments.delete')
  removeAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) { return this.service.removeAttachment(user, id, attachmentId); }
}
