import { Module } from '@nestjs/common';
import { AdministrationRoutesController } from './administration-routes.controller';
import { AdministrationRoutesRepository } from './administration-routes.repository';
import { AdministrationRoutesService } from './administration-routes.service';

@Module({
  controllers: [AdministrationRoutesController],
  providers: [AdministrationRoutesService, AdministrationRoutesRepository],
  exports: [AdministrationRoutesService],
})
export class AdministrationRoutesModule {}
