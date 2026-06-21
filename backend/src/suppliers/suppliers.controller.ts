import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}
  @Get() @RequirePermission('suppliers.read') @ApiOperation({ summary: 'Liste fournisseurs' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get(':id') @RequirePermission('suppliers.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Post() @RequirePermission('suppliers.create') create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) { return this.service.create(user, dto); }
  @Patch(':id') @RequirePermission('suppliers.update') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto) { return this.service.update(user, id, dto); }
  @Delete(':id') @RequirePermission('suppliers.delete') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user, id); }
}
