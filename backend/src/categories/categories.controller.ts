import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @RequirePermission('categories.read')
  @ApiOperation({ summary: 'Liste categories du tenant courant' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermission('categories.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('categories.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('categories.update')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('categories.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
