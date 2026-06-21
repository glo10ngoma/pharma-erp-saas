import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  constructor(private readonly repository: PaymentsRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findBySale(user: AuthUser, saleId: string) { return this.repository.findBySale(user, saleId); }
}
