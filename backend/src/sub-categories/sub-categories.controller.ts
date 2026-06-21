import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';
import { SubCategoriesService } from './sub-categories.service';

@ApiTags('sub-categories')
@ApiBearerAuth()
@Controller('sub-categories')
export class SubCategoriesController {
  constructor(private readonly service: SubCategoriesService) {}

  @Get()
  @RequirePermission('sub_categories.read')
  @ApiOperation({ summary: 'Liste sous-categories du tenant courant' })
  findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }

  @Get(':id')
  @RequirePermission('sub_categories.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }

  @Post()
  @RequirePermission('sub_categories.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubCategoryDto) { return this.service.create(user, dto); }

  @Patch(':id')
  @RequirePermission('sub_categories.update')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSubCategoryDto) { return this.service.update(user, id, dto); }

  @Delete(':id')
  @RequirePermission('sub_categories.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user, id); }
}
