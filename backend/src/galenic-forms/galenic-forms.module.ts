import { Module } from '@nestjs/common';
import { GalenicFormsController } from './galenic-forms.controller';
import { GalenicFormsRepository } from './galenic-forms.repository';
import { GalenicFormsService } from './galenic-forms.service';

@Module({
  controllers: [GalenicFormsController],
  providers: [GalenicFormsService, GalenicFormsRepository],
  exports: [GalenicFormsService],
})
export class GalenicFormsModule {}
