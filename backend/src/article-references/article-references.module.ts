import { Module } from '@nestjs/common';
import { ArticleReferencesController } from './article-references.controller';
import { ArticleReferencesRepository } from './article-references.repository';
import { ArticleReferencesService } from './article-references.service';

@Module({
  controllers: [ArticleReferencesController],
  providers: [ArticleReferencesRepository, ArticleReferencesService],
  exports: [ArticleReferencesService],
})
export class ArticleReferencesModule {}
