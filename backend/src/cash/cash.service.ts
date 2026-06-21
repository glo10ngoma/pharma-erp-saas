import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CashRepository } from './cash.repository';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashExpenseDto } from './dto/create-cash-expense.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

@Injectable()
export class CashService {
  constructor(private readonly repository: CashRepository) {}

  findSessions(user: AuthUser) {
    return this.repository.findSessions(user);
  }

  openSession(user: AuthUser, dto: OpenCashSessionDto) {
    return this.repository.openSession(user, dto);
  }

  currentSession(user: AuthUser, siteId?: string) {
    return this.repository.currentSession(user, siteId);
  }

  closeSession(user: AuthUser, id: string, dto: CloseCashSessionDto) {
    return this.repository.closeSession(user, id, dto);
  }

  findMovements(user: AuthUser, sessionId?: string) {
    return this.repository.findMovements(user, sessionId);
  }

  createExpense(user: AuthUser, dto: CreateCashExpenseDto) {
    return this.repository.createExpense(user, dto);
  }
}
