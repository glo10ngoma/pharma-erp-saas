import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@ApiBearerAuth()
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  @Get()
  @RequirePermission('memberships.read')
  findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }

  @Post()
  @RequirePermission('memberships.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMembershipDto) { return this.service.create(user, dto); }

  @Get(':id')
  @RequirePermission('memberships.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
}
