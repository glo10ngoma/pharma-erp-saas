import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get()
  @RequirePermission('comments.read')
  @ApiOperation({ summary: 'Lister les commentaires d une entite' })
  findByEntity(@CurrentUser() user: AuthUser, @Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.service.findByEntity(user, entityType, entityId);
  }

  @Post()
  @RequirePermission('comments.create')
  @ApiOperation({ summary: 'Ajouter un commentaire ou une reponse' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCommentDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('comments.update')
  @ApiOperation({ summary: 'Modifier un commentaire' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('comments.delete')
  @ApiOperation({ summary: 'Supprimer logiquement un commentaire' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
