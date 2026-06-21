import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AddInventoryItemDto } from './dto/add-inventory-item.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoriesService } from './inventories.service';

@ApiTags('inventories')
@ApiBearerAuth()
@Controller('inventories')
export class InventoriesController {
  constructor(private readonly service: InventoriesService) {}

  @Get()
  @RequirePermission('inventories.read')
  @ApiOperation({ summary: 'Liste inventaires' })
  findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }

  @Post()
  @RequirePermission('inventories.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInventoryDto) { return this.service.create(user, dto); }

  @Get(':id')
  @RequirePermission('inventories.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }

  @Post(':id/start')
  @RequirePermission('inventories.start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.start(user, id); }

  @Post(':id/close')
  @RequirePermission('inventories.close')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.close(user, id); }

  @Post(':id/validate')
  @RequirePermission('inventories.validate')
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.validate(user, id); }

  @Get(':id/items')
  @RequirePermission('inventories.read')
  findItems(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findItems(user, id); }

  @Post(':id/items')
  @RequirePermission('inventories.start')
  addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddInventoryItemDto) { return this.service.addItem(user, id, dto); }

  @Patch(':id/items/:itemId')
  @RequirePermission('inventories.start')
  updateItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateInventoryItemDto) { return this.service.updateItem(user, id, itemId, dto); }
}
