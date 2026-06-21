import { Module } from '@nestjs/common';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { StockMovementsRepository } from './stock-movements.repository';

@Module({
  controllers: [StockMovementsController],
  providers: [StockMovementsService, StockMovementsRepository],
  exports: [StockMovementsService],
})
export class StockMovementsModule {}
