import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { StocksService } from './stocks.service';

@ApiTags('stocks')
@ApiBearerAuth()
@Controller('stocks')
export class StocksController {
  constructor(private readonly service: StocksService) {}
  @Get() @RequirePermission('stocks.read') @ApiOperation({ summary: 'Liste stocks par lot' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get('articles/:articleId') @RequirePermission('stocks.read') @ApiOperation({ summary: 'Stocks par article' }) findByArticle(@CurrentUser() user: AuthUser, @Param('articleId') articleId: string) { return this.service.findByArticle(user, articleId); }
}
