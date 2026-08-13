import { Module } from '@nestjs/common';
import { CashModule } from '../cash/cash.module';
import { SalesModule } from '../sales/sales.module';
import { PosSyncController } from './pos-sync.controller';
import { PosSyncRepository } from './pos-sync.repository';
import { PosSyncService } from './pos-sync.service';

@Module({
  imports: [SalesModule, CashModule],
  controllers: [PosSyncController],
  providers: [PosSyncRepository, PosSyncService],
  exports: [PosSyncRepository, PosSyncService],
})
export class PosSyncModule {}
