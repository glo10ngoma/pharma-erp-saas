import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ConfirmFefoActionDto } from './dto/confirm-fefo-action.dto';
import { RemoveExpiredStockDto } from './dto/remove-expired-stock.dto';
import { LotsService } from './lots.service';

@ApiTags('lots')
@ApiBearerAuth()
@Controller('lots')
export class LotsController {
  constructor(private readonly service: LotsService) {}
  @Get() @RequirePermission('lots.read') @ApiOperation({ summary: 'Liste lots' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get('fefo-actions') @RequirePermission('lots.read') @ApiOperation({ summary: 'Historique des actions FEFO' }) findFefoActions(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) { return this.service.findFefoActions(user, siteId); }
  @Get(':id') @RequirePermission('lots.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Post(':id/block') @RequirePermission('lots.block') block(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('reason') reason?: string) { return this.service.block(user, id, reason); }
  @Post(':id/unblock') @RequirePermission('lots.block') unblock(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.unblock(user, id); }
  @Post(':id/fefo-actions') @RequirePermission('fefo.actions.execute') @ApiOperation({ summary: 'Confirmer une action FEFO non stockee' }) confirmFefoAction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ConfirmFefoActionDto) { return this.service.confirmFefoAction(user, id, dto); }
  @Post(':id/remove-expired-stock') @RequirePermission('lots.expired_stock.remove') @ApiOperation({ summary: 'Sortir du stock un lot expire' }) removeExpiredStock(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RemoveExpiredStockDto) { return this.service.removeExpiredStock(user, id, dto); }
}
