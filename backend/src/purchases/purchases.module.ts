import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PurchasesRepository } from './purchases.repository';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, PurchasesRepository],
  exports: [PurchasesService],
})
export class PurchasesModule {}
