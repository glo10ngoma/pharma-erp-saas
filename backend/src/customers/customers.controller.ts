import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';
import { MembershipsService } from '../memberships/memberships.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService, private readonly memberships: MembershipsService) {}
  @Get() @RequirePermission('customers.read') @ApiOperation({ summary: 'Liste clients' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get(':customerId/memberships') @RequirePermission('memberships.read') findMemberships(@CurrentUser() user: AuthUser, @Param('customerId') customerId: string) { return this.memberships.findByCustomer(user, customerId); }
  @Get(':id') @RequirePermission('customers.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Post() @RequirePermission('customers.create') create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) { return this.service.create(user, dto); }
  @Patch(':id') @RequirePermission('customers.update') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.service.update(user, id, dto); }
  @Delete(':id') @RequirePermission('customers.delete') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user, id); }
}
