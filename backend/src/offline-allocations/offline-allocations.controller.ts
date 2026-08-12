import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateOfflineAllocationDto } from './dto/create-offline-allocation.dto';
import { ListOfflineAllocationsDto } from './dto/list-offline-allocations.dto';
import { RebalanceOfflineAllocationsDto } from './dto/rebalance-offline-allocations.dto';
import { TransferOfflineAllocationDto } from './dto/transfer-offline-allocation.dto';
import { UpdateOfflineAllocationDto } from './dto/update-offline-allocation.dto';
import { OfflineAllocationsService } from './offline-allocations.service';

@ApiTags('offline-allocations')
@ApiBearerAuth()
@Controller('offline-allocations')
export class OfflineAllocationsController {
  constructor(private readonly service: OfflineAllocationsService) {}

  @Get()
  @RequirePermission('offline_allocations.read')
  @ApiOperation({ summary: 'Lister les allocations offline par poste et lot' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListOfflineAllocationsDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @RequirePermission('offline_allocations.read')
  @ApiOperation({ summary: 'Detail d une allocation offline' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('offline_allocations.manage')
  @ApiOperation({ summary: 'Creer ou augmenter une allocation offline' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOfflineAllocationDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('offline_allocations.manage')
  @ApiOperation({ summary: 'Modifier une allocation offline' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOfflineAllocationDto) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/suspend')
  @RequirePermission('offline_allocations.manage')
  @ApiOperation({ summary: 'Suspendre une allocation offline' })
  suspend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.suspend(user, id);
  }

  @Post(':id/revoke')
  @RequirePermission('offline_allocations.manage')
  @ApiOperation({ summary: 'Revoquer une allocation offline' })
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.revoke(user, id);
  }

  @Post(':id/release')
  @RequirePermission('offline_allocations.manage')
  @ApiOperation({ summary: 'Liberer la quantite restante d une allocation offline' })
  release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.release(user, id);
  }

  @Post('transfer')
  @RequirePermission('offline_allocations.transfer')
  @ApiOperation({ summary: 'Transferer du quota offline entre deux postes' })
  transfer(@CurrentUser() user: AuthUser, @Body() dto: TransferOfflineAllocationDto) {
    return this.service.transfer(user, dto);
  }

  @Post('rebalance')
  @RequirePermission('offline_allocations.rebalance')
  @ApiOperation({ summary: 'Repartition automatique egale d un quota offline' })
  rebalance(@CurrentUser() user: AuthUser, @Body() dto: RebalanceOfflineAllocationsDto) {
    return this.service.rebalance(user, dto);
  }
}
