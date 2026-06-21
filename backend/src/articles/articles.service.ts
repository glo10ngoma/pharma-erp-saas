import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ArticlesRepository } from './articles.repository';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly repository: ArticlesRepository) {}

  findAll(user: AuthUser, query: ListArticlesDto) {
    return this.repository.findAll(user, query);
  }

  create(user: AuthUser, dto: CreateArticleDto) {
    return this.wrapReferenceErrors(() => this.repository.create(user, dto));
  }

  async findOne(user: AuthUser, articleId: string) {
    const article = await this.repository.findOne(user, articleId);
    if (!article) throw new NotFoundException('ARTICLE_NOT_FOUND');
    return article;
  }

  async update(user: AuthUser, articleId: string, dto: UpdateArticleDto) {
    return this.wrapReferenceErrors(async () => {
      const article = await this.repository.update(user, articleId, dto);
      if (!article) throw new NotFoundException('ARTICLE_NOT_FOUND');
      return article;
    });
  }

  async remove(user: AuthUser, articleId: string) {
    const article = await this.repository.remove(user, articleId);
    if (!article) throw new NotFoundException('ARTICLE_NOT_FOUND');
    return article;
  }

  private async wrapReferenceErrors<T>(callback: () => Promise<T>) {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof Error && error.message.endsWith('_NOT_IN_TENANT')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
