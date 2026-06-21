import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesRepository } from './sales.repository';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesService],
})
export class SalesModule {}
