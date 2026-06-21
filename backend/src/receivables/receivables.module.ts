import { Module } from '@nestjs/common';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';
import { ReceivablesRepository } from './receivables.repository';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [ReceivablesController],
  providers: [ReceivablesService, ReceivablesRepository],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
