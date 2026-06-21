import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Get() @RequirePermission('payments.read') @ApiOperation({ summary: 'Liste paiements' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get('sale/:saleId') @RequirePermission('payments.read') @ApiOperation({ summary: 'Paiements par vente' }) findBySale(@CurrentUser() user: AuthUser, @Param('saleId') saleId: string) { return this.service.findBySale(user, saleId); }
}
