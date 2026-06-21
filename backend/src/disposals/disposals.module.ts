import { Module } from '@nestjs/common';
import { DisposalsController } from './disposals.controller';
import { DisposalsService } from './disposals.service';
import { DisposalsRepository } from './disposals.repository';

@Module({
  controllers: [DisposalsController],
  providers: [DisposalsService, DisposalsRepository],
  exports: [DisposalsService],
})
export class DisposalsModule {}
