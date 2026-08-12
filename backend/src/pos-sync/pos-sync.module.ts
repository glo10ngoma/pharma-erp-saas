import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { PosSyncController } from './pos-sync.controller';
import { PosSyncRepository } from './pos-sync.repository';
import { PosSyncService } from './pos-sync.service';

@Module({
  imports: [SalesModule],
  controllers: [PosSyncController],
  providers: [PosSyncRepository, PosSyncService],
  exports: [PosSyncRepository, PosSyncService],
})
export class PosSyncModule {}
