import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingRepository } from './accounting.repository';

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, AccountingRepository],
  exports: [AccountingService, AccountingRepository],
})
export class AccountingModule {}
