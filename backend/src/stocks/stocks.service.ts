import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ListStockSummaryDto } from './dto/list-stock-summary.dto';
import { StockDetailQueryDto } from './dto/stock-detail-query.dto';
import { StocksRepository } from './stocks.repository';

@Injectable()
export class StocksService {
  constructor(private readonly repository: StocksRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findByArticle(user: AuthUser, articleId: string) { return this.repository.findByArticle(user, articleId); }
  findSummary(user: AuthUser, query: ListStockSummaryDto) { return this.repository.findSummary(user, query); }
  findDetail(user: AuthUser, query: StockDetailQueryDto) { return this.repository.findDetail(user, query); }
}
