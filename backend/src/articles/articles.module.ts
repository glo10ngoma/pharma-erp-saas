import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ArticlesRepository } from './articles.repository';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService, ArticlesRepository],
  exports: [ArticlesService],
})
export class ArticlesModule {}
