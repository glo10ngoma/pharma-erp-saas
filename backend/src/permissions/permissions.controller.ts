import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  @RequirePermission('permissions.read')
  @ApiOperation({ summary: 'Liste des permissions disponibles' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermission('permissions.read')
  @ApiOperation({ summary: 'Detail permission' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('permissions.create')
  @ApiOperation({ summary: 'Creer une permission' })
  create(@Body() dto: CreatePermissionDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('permissions.update')
  @ApiOperation({ summary: 'Modifier une permission' })
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('permissions.delete')
  @ApiOperation({ summary: 'Supprimer une permission non liee' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
