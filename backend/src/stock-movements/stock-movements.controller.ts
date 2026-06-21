import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { StockMovementsService } from './stock-movements.service';

@ApiTags('stock-movements')
@ApiBearerAuth()
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}
  @Get() @RequirePermission('stock_movements.read') @ApiOperation({ summary: 'Liste mouvements stock' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
}
