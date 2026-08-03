import { Module } from '@nestjs/common';
import { PurchasesModule } from '../purchases/purchases.module';
import { SalesModule } from '../sales/sales.module';
import { CustomerReturnsController } from './customer-returns.controller';
import { CustomerReturnsRepository } from './customer-returns.repository';
import { CustomerReturnsService } from './customer-returns.service';

@Module({
  imports: [PurchasesModule, SalesModule],
  controllers: [CustomerReturnsController],
  providers: [CustomerReturnsRepository, CustomerReturnsService],
})
export class CustomerReturnsModule {}
