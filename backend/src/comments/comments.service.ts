import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CommentsRepository } from './comments.repository';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly repository: CommentsRepository) {}

  findByEntity(user: AuthUser, entityType: string, entityId: string) {
    return this.repository.findByEntity(user, entityType, entityId);
  }

  create(user: AuthUser, dto: CreateCommentDto) {
    return this.repository.create(user, dto);
  }

  async update(user: AuthUser, commentId: string, dto: UpdateCommentDto) {
    const item = await this.repository.update(user, commentId, dto);
    if (!item) throw new NotFoundException('COMMENT_NOT_FOUND');
    return item;
  }

  remove(user: AuthUser, commentId: string) {
    return this.repository.remove(user, commentId);
  }
}
