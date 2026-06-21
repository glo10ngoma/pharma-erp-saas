import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { StocksRepository } from './stocks.repository';

@Injectable()
export class StocksService {
  constructor(private readonly repository: StocksRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findByArticle(user: AuthUser, articleId: string) { return this.repository.findByArticle(user, articleId); }
}
