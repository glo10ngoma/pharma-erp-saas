import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersRepository } from './customers.repository';
import { MembershipsModule } from '../memberships/memberships.module';

@Module({
  imports: [MembershipsModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersRepository],
  exports: [CustomersService],
})
export class CustomersModule {}
