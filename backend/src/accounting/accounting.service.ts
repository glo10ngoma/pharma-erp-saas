import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { AccountingRepository } from './accounting.repository';

@Injectable()
export class AccountingService {
  constructor(private readonly repository: AccountingRepository) {}

  findAccounts(user: AuthUser) { return this.repository.findAccounts(user); }
  createAccount(user: AuthUser, dto: CreateAccountDto) { return this.repository.createAccount(user, dto); }
  findJournals(user: AuthUser) { return this.repository.findJournals(user); }
  createJournal(user: AuthUser, dto: CreateJournalDto) { return this.repository.createJournal(user, dto); }
  findEntries(user: AuthUser) { return this.repository.findEntries(user); }
  findEntry(user: AuthUser, id: string) { return this.repository.findEntry(user, id); }
  postEntry(user: AuthUser, id: string) { return this.repository.postEntry(user, id); }
  trialBalance(user: AuthUser) { return this.repository.trialBalance(user); }
  generalLedger(user: AuthUser, accountCode?: string) { return this.repository.generalLedger(user, accountCode); }
}
