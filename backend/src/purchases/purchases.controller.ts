import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
const memoryStorage = require('multer').memoryStorage;
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AddPurchaseItemDto } from './dto/add-purchase-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UploadPurchaseAttachmentDto } from './dto/upload-purchase-attachment.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchaseAttachmentsService } from './purchase-attachments.service';
import { PurchasesService } from './purchases.service';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly service: PurchasesService,
    private readonly attachments: PurchaseAttachmentsService,
  ) {}
  @Get() @RequirePermission('purchases.read') @ApiOperation({ summary: 'Liste achats' }) findAll(@CurrentUser() user: AuthUser, @Query('status') status?: string) { return this.service.findAll(user, status); }
  @Post() @RequirePermission('purchases.create') create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseDto) { return this.service.create(user, dto); }
  @Get(':id') @RequirePermission('purchases.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Patch(':id') @RequirePermission('purchases.update_draft') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePurchaseDto) { return this.service.update(user, id, dto); }
  @Post(':id/items') @RequirePermission('purchases.update_draft') addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddPurchaseItemDto) { return this.service.addItem(user, id, dto); }
  @Delete(':id/items/:itemId') @RequirePermission('purchases.update_draft') removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) { return this.service.removeItem(user, id, itemId); }
  @Post(':id/validate') @RequirePermission('purchases.validate') validate(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.validate(user, id); }
  @Get(':id/attachments') @RequirePermission('purchase_attachments.read') listAttachments(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.attachments.findForPurchase(user, id); }
  @Post(':id/attachments')
  @RequirePermission('purchase_attachments.create')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file: any, @Body() dto: UploadPurchaseAttachmentDto) { return this.attachments.uploadForPurchase(user, id, file, dto); }
  @Get(':id/attachments/:attachmentId/url') @RequirePermission('purchase_attachments.read') attachmentUrl(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) { return this.attachments.signedUrlForPurchase(user, id, attachmentId); }
  @Delete(':id/attachments/:attachmentId') @RequirePermission('purchase_attachments.delete') removeAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) { return this.attachments.removeForPurchase(user, id, attachmentId); }
}
