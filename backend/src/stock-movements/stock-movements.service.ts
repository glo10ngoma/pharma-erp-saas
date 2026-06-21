import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { StockMovementsRepository } from './stock-movements.repository';

@Injectable()
export class StockMovementsService {
  constructor(private readonly repository: StockMovementsRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
}
