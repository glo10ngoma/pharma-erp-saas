import { Module } from '@nestjs/common';
import { InsurancePlansController } from './insurance-plans.controller';
import { InsurancePlansService } from './insurance-plans.service';
import { InsurancePlansRepository } from './insurance-plans.repository';

@Module({
  controllers: [InsurancePlansController],
  providers: [InsurancePlansService, InsurancePlansRepository],
  exports: [InsurancePlansService],
})
export class InsurancePlansModule {}
