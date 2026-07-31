import { Module } from '@nestjs/common';
import { PurchasesModule } from '../purchases/purchases.module';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { PurchaseReturnsRepository } from './purchase-returns.repository';
import { PurchaseReturnsService } from './purchase-returns.service';

@Module({
  imports: [PurchasesModule],
  controllers: [PurchaseReturnsController],
  providers: [PurchaseReturnsRepository, PurchaseReturnsService],
})
export class PurchaseReturnsModule {}
