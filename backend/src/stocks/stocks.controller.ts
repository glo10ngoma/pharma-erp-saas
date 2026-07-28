import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ListStockSummaryDto } from './dto/list-stock-summary.dto';
import { StockDetailQueryDto } from './dto/stock-detail-query.dto';
import { StocksService } from './stocks.service';

@ApiTags('stocks')
@ApiBearerAuth()
@Controller('stocks')
export class StocksController {
  constructor(private readonly service: StocksService) {}
  @Get('summary') @RequirePermission('stocks.read') @ApiOperation({ summary: 'Resume pagine des stocks' }) findSummary(@CurrentUser() user: AuthUser, @Query() query: ListStockSummaryDto) { return this.service.findSummary(user, query); }
  @Get('detail') @RequirePermission('stocks.read') @ApiOperation({ summary: 'Detail stock par article et site' }) findDetail(@CurrentUser() user: AuthUser, @Query() query: StockDetailQueryDto) { return this.service.findDetail(user, query); }
  @Get() @RequirePermission('stocks.read') @ApiOperation({ summary: 'Liste stocks par lot' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get('articles/:articleId') @RequirePermission('stocks.read') @ApiOperation({ summary: 'Stocks par article' }) findByArticle(@CurrentUser() user: AuthUser, @Param('articleId') articleId: string) { return this.service.findByArticle(user, articleId); }
}
