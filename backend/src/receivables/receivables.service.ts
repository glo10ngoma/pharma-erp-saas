import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { PayReceivableDto } from './dto/pay-receivable.dto';
import { ReceivablesRepository } from './receivables.repository';

@Injectable()
export class ReceivablesService {
  constructor(private readonly repository: ReceivablesRepository) {}

  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findOne(user: AuthUser, id: string) { return this.repository.findOne(user, id); }
  summary(user: AuthUser) { return this.repository.summary(user); }
  pay(user: AuthUser, id: string, dto: PayReceivableDto) { return this.repository.pay(user, id, dto); }
}
