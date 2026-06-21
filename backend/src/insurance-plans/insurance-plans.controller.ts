import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateInsurancePlanDto } from './dto/create-insurance-plan.dto';
import { UpdateInsurancePlanDto } from './dto/update-insurance-plan.dto';
import { InsurancePlansService } from './insurance-plans.service';

@ApiTags('insurance-plans')
@ApiBearerAuth()
@Controller('insurance-plans')
export class InsurancePlansController {
  constructor(private readonly service: InsurancePlansService) {}

  @Get()
  @RequirePermission('insurance_plans.read')
  findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }

  @Post()
  @RequirePermission('insurance_plans.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInsurancePlanDto) { return this.service.create(user, dto); }

  @Get(':id')
  @RequirePermission('insurance_plans.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }

  @Patch(':id')
  @RequirePermission('insurance_plans.update')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInsurancePlanDto) { return this.service.update(user, id, dto); }
}
