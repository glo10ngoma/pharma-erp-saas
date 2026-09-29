import { Module } from '@nestjs/common';
import { PriceChecksController } from './price-checks.controller';
import { PriceChecksRepository } from './price-checks.repository';
import { PriceChecksService } from './price-checks.service';

@Module({
  controllers: [PriceChecksController],
  providers: [PriceChecksService, PriceChecksRepository],
})
export class PriceChecksModule {}
