import { Module } from '@nestjs/common';
import { OfflineAllocationsController } from './offline-allocations.controller';
import { OfflineAllocationsRepository } from './offline-allocations.repository';
import { OfflineAllocationsService } from './offline-allocations.service';

@Module({
  controllers: [OfflineAllocationsController],
  providers: [OfflineAllocationsRepository, OfflineAllocationsService],
  exports: [OfflineAllocationsRepository, OfflineAllocationsService],
})
export class OfflineAllocationsModule {}
