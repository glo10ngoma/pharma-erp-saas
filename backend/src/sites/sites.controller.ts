import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

@ApiTags('sites')
@ApiBearerAuth()
@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Get()
  @RequirePermission('sites.read')
  @ApiOperation({ summary: 'Liste des sites du tenant courant' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermission('sites.read')
  @ApiOperation({ summary: 'Detail site du tenant courant' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('sites.create')
  @ApiOperation({ summary: 'Creer un site dans le tenant courant' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSiteDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('sites.update')
  @ApiOperation({ summary: 'Modifier un site du tenant courant' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('sites.delete')
  @ApiOperation({ summary: 'Desactiver un site du tenant courant' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
