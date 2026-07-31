import { Module } from '@nestjs/common';
import { WorkstationsController } from './workstations.controller';
import { WorkstationsRepository } from './workstations.repository';
import { WorkstationsService } from './workstations.service';

@Module({
  controllers: [WorkstationsController],
  providers: [WorkstationsRepository, WorkstationsService],
  exports: [WorkstationsRepository, WorkstationsService],
})
export class WorkstationsModule {}
