import { Module } from '@nestjs/common';
import { SubCategoriesController } from './sub-categories.controller';
import { SubCategoriesRepository } from './sub-categories.repository';
import { SubCategoriesService } from './sub-categories.service';

@Module({
  controllers: [SubCategoriesController],
  providers: [SubCategoriesService, SubCategoriesRepository],
  exports: [SubCategoriesService],
})
export class SubCategoriesModule {}
