import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashRepository } from './cash.repository';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [CashController],
  providers: [CashService, CashRepository],
  exports: [CashService],
})
export class CashModule {}
