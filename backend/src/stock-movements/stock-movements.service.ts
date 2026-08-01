import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';
import { StockMovementsRepository } from './stock-movements.repository';

@Injectable()
export class StockMovementsService {
  constructor(private readonly repository: StockMovementsRepository) {}
  findAll(user: AuthUser, query: ListStockMovementsDto) { return this.repository.findAll(user, query); }
  export(user: AuthUser, query: ListStockMovementsDto) { return this.repository.export(user, query); }
}
