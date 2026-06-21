import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('dashboard')
  @RequirePermission('reports.dashboard')
  @ApiOperation({ summary: 'KPIs dashboard BI' })
  dashboard(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.dashboard(user, filters); }

  @Get('sales')
  @RequirePermission('reports.sales')
  @ApiOperation({ summary: 'Rapport ventes par type' })
  sales(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.sales(user, filters); }

  @Get('stock')
  @RequirePermission('reports.stock')
  @ApiOperation({ summary: 'Rapport valeur stock par article' })
  stock(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.stock(user, filters); }

  @Get('margins')
  @RequirePermission('reports.margins')
  @ApiOperation({ summary: 'Rapport marge brute estimee' })
  margins(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.margins(user, filters); }

  @Get('cash')
  @RequirePermission('reports.cash')
  @ApiOperation({ summary: 'Rapport mouvements caisse' })
  cash(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.cash(user, filters); }

  @Get('receivables')
  @RequirePermission('reports.receivables')
  @ApiOperation({ summary: 'Rapport creances' })
  receivables(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.receivables(user, filters); }

  @Get('expiry')
  @RequirePermission('reports.expiry')
  @ApiOperation({ summary: 'Rapport peremptions' })
  expiry(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.expiry(user, filters); }

  @Get('top-products')
  @RequirePermission('reports.top_products')
  @ApiOperation({ summary: 'Top produits vendus' })
  topProducts(@CurrentUser() user: AuthUser, @Query() filters: ReportFilterDto) { return this.service.topProducts(user, filters); }
}
