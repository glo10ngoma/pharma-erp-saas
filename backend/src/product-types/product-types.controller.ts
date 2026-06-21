import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { ProductTypesService } from './product-types.service';

@ApiTags('product-types')
@ApiBearerAuth()
@Controller('product-types')
export class ProductTypesController {
  constructor(private readonly service: ProductTypesService) {}
  @Get() @RequirePermission('product_types.read') @ApiOperation({ summary: 'Liste types produits' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get(':id') @RequirePermission('product_types.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Post() @RequirePermission('product_types.create') create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductTypeDto) { return this.service.create(user, dto); }
  @Patch(':id') @RequirePermission('product_types.update') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductTypeDto) { return this.service.update(user, id, dto); }
  @Delete(':id') @RequirePermission('product_types.delete') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user, id); }
}
