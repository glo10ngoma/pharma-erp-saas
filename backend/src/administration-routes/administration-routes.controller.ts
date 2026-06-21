import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AdministrationRoutesService } from './administration-routes.service';
import { CreateAdministrationRouteDto } from './dto/create-administration-route.dto';
import { UpdateAdministrationRouteDto } from './dto/update-administration-route.dto';

@ApiTags('administration-routes')
@ApiBearerAuth()
@Controller('administration-routes')
export class AdministrationRoutesController {
  constructor(private readonly service: AdministrationRoutesService) {}
  @Get() @RequirePermission('administration_routes.read') @ApiOperation({ summary: 'Liste voies administration' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get(':id') @RequirePermission('administration_routes.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Post() @RequirePermission('administration_routes.create') create(@CurrentUser() user: AuthUser, @Body() dto: CreateAdministrationRouteDto) { return this.service.create(user, dto); }
  @Patch(':id') @RequirePermission('administration_routes.update') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAdministrationRouteDto) { return this.service.update(user, id, dto); }
  @Delete(':id') @RequirePermission('administration_routes.delete') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user, id); }
}
