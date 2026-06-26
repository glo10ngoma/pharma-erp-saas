import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AddTransferItemDto } from './dto/add-transfer-item.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get()
  @RequirePermission('transfers.read')
  @ApiOperation({ summary: 'Liste des transferts inter-sites' })
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.findAll(user, status);
  }

  @Post()
  @RequirePermission('transfers.create')
  @ApiOperation({ summary: 'Créer un transfert brouillon' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @RequirePermission('transfers.read')
  @ApiOperation({ summary: 'Détail transfert' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post(':id/items')
  @RequirePermission('transfers.update_draft')
  @ApiOperation({ summary: 'Ajouter une ligne transfert' })
  addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddTransferItemDto) {
    return this.service.addItem(user, id, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('transfers.update_draft')
  @ApiOperation({ summary: 'Supprimer une ligne transfert brouillon' })
  removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(user, id, itemId);
  }

  @Post(':id/validate')
  @RequirePermission('transfers.validate')
  @ApiOperation({ summary: 'Valider le transfert et créer les mouvements stock' })
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.validate(user, id);
  }
}
