import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { SitesRepository } from './sites.repository';

@Module({
  controllers: [SitesController],
  providers: [SitesService, SitesRepository],
  exports: [SitesService],
})
export class SitesModule {}
