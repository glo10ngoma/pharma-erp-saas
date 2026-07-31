import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PurchasesRepository } from './purchases.repository';
import { PurchaseAttachmentsRepository } from './purchase-attachments.repository';
import { PurchaseAttachmentsService } from './purchase-attachments.service';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, PurchasesRepository, PurchaseAttachmentsRepository, PurchaseAttachmentsService],
  exports: [PurchasesService, PurchaseAttachmentsService],
})
export class PurchasesModule {}
