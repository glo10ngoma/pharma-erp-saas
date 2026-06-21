import { Module } from '@nestjs/common';
import { ProductTypesController } from './product-types.controller';
import { ProductTypesRepository } from './product-types.repository';
import { ProductTypesService } from './product-types.service';

@Module({
  controllers: [ProductTypesController],
  providers: [ProductTypesService, ProductTypesRepository],
  exports: [ProductTypesService],
})
export class ProductTypesModule {}
