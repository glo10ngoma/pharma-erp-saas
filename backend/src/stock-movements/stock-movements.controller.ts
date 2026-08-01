import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';
import { StockMovementsService } from './stock-movements.service';

@ApiTags('stock-movements')
@ApiBearerAuth()
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}
  @Get()
  @RequirePermission('stock_movements.read')
  @ApiOperation({ summary: 'Liste paginee des mouvements de stock' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListStockMovementsDto) {
    return this.service.findAll(user, query);
  }

  @Get('export')
  @RequirePermission('stock_movements.export')
  @ApiOperation({ summary: 'Export logique des mouvements de stock filtres' })
  export(@CurrentUser() user: AuthUser, @Query() query: ListStockMovementsDto) {
    return this.service.export(user, query);
  }
}
