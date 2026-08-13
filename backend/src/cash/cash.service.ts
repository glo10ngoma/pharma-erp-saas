import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import {
  SubmitPosCashExpenseOperation,
  SubmitPosCashSessionCloseOperation,
  SubmitPosCashSessionOpenOperation,
} from '../pos-sync/dto/submit-pos-operations.dto';
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

  openSession(user: AuthUser, dto: OpenCashSessionDto, ipAddress?: string) {
    return this.repository.openSession(user, dto, ipAddress);
  }

  currentSession(user: AuthUser, siteId?: string, deviceUuid?: string, workstationId?: string) {
    return this.repository.currentSession(user, siteId, deviceUuid, workstationId);
  }

  openSessionForUser(user: AuthUser, siteId?: string) {
    return this.repository.openSessionForUser(user, siteId);
  }

  closeSession(user: AuthUser, id: string, dto: CloseCashSessionDto, ipAddress?: string) {
    return this.repository.closeSession(user, id, dto, ipAddress);
  }

  findMovements(user: AuthUser, sessionId?: string) {
    return this.repository.findMovements(user, sessionId);
  }

  createExpense(user: AuthUser, dto: CreateCashExpenseDto) {
    return this.repository.createExpense(user, dto);
  }

  replayOfflineOpenSession(user: AuthUser, operation: SubmitPosCashSessionOpenOperation) {
    return this.repository.replayOfflineOpenSession(user, operation);
  }

  replayOfflineExpense(user: AuthUser, operation: SubmitPosCashExpenseOperation) {
    return this.repository.replayOfflineExpense(user, operation);
  }

  replayOfflineCloseSession(user: AuthUser, operation: SubmitPosCashSessionCloseOperation) {
    return this.repository.replayOfflineCloseSession(user, operation);
  }
}
