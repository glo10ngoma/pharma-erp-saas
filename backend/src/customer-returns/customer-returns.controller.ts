import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
const memoryStorage = require('multer').memoryStorage;
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { UploadPurchaseAttachmentDto } from '../purchases/dto/upload-purchase-attachment.dto';
import { AddCustomerReturnItemDto } from './dto/add-customer-return-item.dto';
import { AddCustomerReturnReplacementItemDto } from './dto/add-customer-return-replacement-item.dto';
import { AddCustomerReturnSettlementDto } from './dto/add-customer-return-settlement.dto';
import { CreateCustomerReturnDto } from './dto/create-customer-return.dto';
import { InspectCustomerReturnDto } from './dto/inspect-customer-return.dto';
import { ListCustomerReturnsDto } from './dto/list-customer-returns.dto';
import { SearchValidatedSalesDto } from './dto/search-validated-sales.dto';
import { SearchCustomerReturnSalesDto } from './dto/search-customer-return-sales.dto';
import { CustomerReturnsService } from './customer-returns.service';

@ApiTags('customer-returns')
@ApiBearerAuth()
@Controller('customer-returns')
export class CustomerReturnsController {
  constructor(private readonly service: CustomerReturnsService) {}

  @Get('customer-credits')
  @RequirePermission('customer_credits.read')
  @ApiOperation({ summary: 'Lister les avoirs clients' })
  findCustomerCredits(@CurrentUser() user: AuthUser, @Query('customerId') customerId?: string) {
    return this.service.findCustomerCredits(user, customerId);
  }

  @Get()
  @RequirePermission('customer_returns.read')
  @ApiOperation({ summary: 'Lister les retours clients' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListCustomerReturnsDto) {
    return this.service.findAll(user, query);
  }

  @Get('validated-sales')
  @RequirePermission('customer_returns.create')
  @ApiOperation({ summary: 'Rechercher des ventes validees pour un retour client' })
  searchValidatedSales(@CurrentUser() user: AuthUser, @Query() query: SearchValidatedSalesDto) {
    return this.service.searchValidatedSales(user, query);
  }

  @Get('sales-search')
  @RequirePermission('customer_returns.create')
  @ApiOperation({ summary: 'Rechercher des ventes probables pour un retour client sans facture' })
  searchSales(@CurrentUser() user: AuthUser, @Query() query: SearchCustomerReturnSalesDto) {
    return this.service.searchProbableSales(user, query);
  }

  @Post()
  @RequirePermission('customer_returns.create')
  @ApiOperation({ summary: 'Creer un dossier de retour client' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerReturnDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @RequirePermission('customer_returns.read')
  @ApiOperation({ summary: 'Consulter un retour client' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermission('customer_returns.traceability.review')
  @ApiOperation({ summary: 'Mettre a jour les informations de tracabilite d un retour client' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateCustomerReturnDto) {
    return this.service.update(user, id, dto);
  }

  @Get(':id/traceability')
  @RequirePermission('customer_returns.traceability.review')
  @ApiOperation({ summary: 'Consulter le diagnostic de tracabilite d un retour client' })
  traceability(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.traceability(user, id);
  }

  @Post(':id/approve-unlinked')
  @RequirePermission('customer_returns.unlinked.approve')
  @ApiOperation({ summary: 'Approuver responsablement un retour client sans facture' })
  approveUnlinked(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.approveUnlinked(user, id);
  }

  @Post(':id/items')
  @RequirePermission('customer_returns.create')
  @ApiOperation({ summary: 'Ajouter une ligne de retour client' })
  addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddCustomerReturnItemDto) {
    return this.service.addItem(user, id, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('customer_returns.create')
  @ApiOperation({ summary: 'Retirer une ligne de retour client' })
  removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(user, id, itemId);
  }

  @Post(':id/replacements')
  @RequirePermission('customer_returns.exchange')
  @ApiOperation({ summary: 'Ajouter une ligne d echange client' })
  addReplacement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddCustomerReturnReplacementItemDto) {
    return this.service.addReplacementItem(user, id, dto);
  }

  @Delete(':id/replacements/:itemId')
  @RequirePermission('customer_returns.exchange')
  @ApiOperation({ summary: 'Supprimer une ligne d echange client' })
  removeReplacement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeReplacementItem(user, id, itemId);
  }

  @Post(':id/settlements')
  @RequirePermission('customer_returns.read')
  @ApiOperation({ summary: 'Ajouter une regularisation financiere du retour client' })
  addSettlement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddCustomerReturnSettlementDto) {
    return this.service.addSettlement(user, id, dto);
  }

  @Delete(':id/settlements/:settlementId')
  @RequirePermission('customer_returns.read')
  @ApiOperation({ summary: 'Supprimer une regularisation financiere du retour client' })
  removeSettlement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('settlementId') settlementId: string) {
    return this.service.removeSettlement(user, id, settlementId);
  }

  @Post(':id/submit-inspection')
  @RequirePermission('customer_returns.inspect')
  @ApiOperation({ summary: 'Passer le dossier en inspection' })
  submitInspection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.submitForInspection(user, id);
  }

  @Post(':id/inspect')
  @RequirePermission('customer_returns.inspect')
  @ApiOperation({ summary: 'Enregistrer la decision d inspection' })
  inspect(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: InspectCustomerReturnDto) {
    return this.service.inspect(user, id, dto);
  }

  @Post(':id/validate')
  @RequirePermission('customer_returns.validate')
  @ApiOperation({ summary: 'Valider un retour client' })
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.validate(user, id);
  }

  @Post(':id/cancel')
  @RequirePermission('customer_returns.cancel')
  @ApiOperation({ summary: 'Annuler un retour client' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.cancel(user, id);
  }

  @Get(':id/attachments')
  @RequirePermission('customer_return_attachments.read')
  attachments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findAttachments(user, id);
  }

  @Post(':id/attachments')
  @RequirePermission('customer_return_attachments.create')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file: any, @Body() dto: UploadPurchaseAttachmentDto) {
    return this.service.uploadAttachment(user, id, file, dto);
  }

  @Get(':id/attachments/:attachmentId/url')
  @RequirePermission('customer_return_attachments.read')
  attachmentUrl(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.service.attachmentUrl(user, id, attachmentId);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermission('customer_return_attachments.delete')
  removeAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.service.removeAttachment(user, id, attachmentId);
  }
}
