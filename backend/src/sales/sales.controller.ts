import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AddSaleItemFefoDto } from './dto/add-sale-item-fefo.dto';
import { ApplyInsuranceDto } from './dto/apply-insurance.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDraftDto } from './dto/update-sale-draft.dto';
import { ValidateSaleDto } from './dto/validate-sale.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}
  @Get() @RequirePermission('sales.read') @ApiOperation({ summary: 'Liste ventes' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Post() @RequirePermission('sales.create') create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) { return this.service.create(user, dto); }
  @Get(':id') @RequirePermission('sales.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Patch(':id') @RequirePermission('sales.update_draft') updateDraft(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSaleDraftDto) { return this.service.updateDraft(user, id, dto); }
  @Post(':id/items/fefo') @RequirePermission('sales.update_draft') addItemFefo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddSaleItemFefoDto) { return this.service.addItemFefo(user, id, dto); }
  @Post(':id/apply-insurance') @RequirePermission('sales.update_draft') applyInsurance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ApplyInsuranceDto) { return this.service.applyInsurance(user, id, dto); }
  @Delete(':id/items/:itemId') @RequirePermission('sales.update_draft') removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) { return this.service.removeItem(user, id, itemId); }
  @Post(':id/validate') @RequirePermission('sales.validate') validate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ValidateSaleDto) { return this.service.validate(user, id, dto); }
  @Post(':id/cancel') @RequirePermission('sales.cancel_draft') cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.cancel(user, id); }
}
