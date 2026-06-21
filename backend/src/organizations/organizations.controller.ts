import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  @RequirePermission('organizations.read')
  @ApiOperation({ summary: 'Liste organisations' })
  findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }

  @Post()
  @RequirePermission('organizations.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) { return this.service.create(user, dto); }

  @Get(':id')
  @RequirePermission('organizations.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }

  @Patch(':id')
  @RequirePermission('organizations.update')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrganizationDto) { return this.service.update(user, id, dto); }

  @Post(':id/disable')
  @RequirePermission('organizations.disable')
  disable(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.disable(user, id); }
}
