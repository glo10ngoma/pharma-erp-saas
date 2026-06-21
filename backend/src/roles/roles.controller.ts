import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @RequirePermission('roles.read')
  @ApiOperation({ summary: 'Liste des roles du tenant courant' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermission('roles.read')
  @ApiOperation({ summary: 'Detail role du tenant courant' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('roles.create')
  @ApiOperation({ summary: 'Creer un role dans le tenant courant' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('roles.update')
  @ApiOperation({ summary: 'Modifier un role du tenant courant' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Put(':id/permissions')
  @RequirePermission('roles.assign_permissions')
  @ApiOperation({ summary: 'Remplacer les permissions affectees au role' })
  assignPermissions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignRolePermissionsDto,
  ) {
    return this.service.assignPermissions(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('roles.delete')
  @ApiOperation({ summary: 'Desactiver un role du tenant courant' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
