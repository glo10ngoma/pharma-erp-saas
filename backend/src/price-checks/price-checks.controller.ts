import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreatePriceCheckDto } from './dto/create-price-check.dto';
import { ListPriceChecksDto } from './dto/list-price-checks.dto';
import { PriceChecksService } from './price-checks.service';

@ApiTags('price-checks')
@ApiBearerAuth()
@Controller('price-checks')
export class PriceChecksController {
  constructor(private readonly service: PriceChecksService) {}

  @Get('articles/search')
  @RequirePermission('price_checks.create')
  @ApiOperation({ summary: 'Recherche articles pour verification de prix' })
  searchArticles(@CurrentUser() user: AuthUser, @Query('siteId') siteId: string, @Query('search') search?: string) {
    return this.service.searchArticles(user, siteId, search);
  }

  @Get()
  @RequirePermission('price_checks.read')
  @ApiOperation({ summary: 'Historique des verifications de prix' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListPriceChecksDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @RequirePermission('price_checks.read')
  @ApiOperation({ summary: 'Detail verification de prix' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('price_checks.create')
  @ApiOperation({ summary: 'Creer une verification de prix sans vente ni mouvement stock' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceCheckDto) {
    return this.service.create(user, dto);
  }
}
