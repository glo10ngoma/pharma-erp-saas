import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('articles')
@ApiBearerAuth()
@Controller('articles')
export class ArticlesController {
  constructor(private readonly service: ArticlesService) {}

  @Get()
  @RequirePermission('articles.read')
  @ApiOperation({ summary: 'Liste articles du tenant courant' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListArticlesDto) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @RequirePermission('articles.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('articles.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('articles.update')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('articles.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
