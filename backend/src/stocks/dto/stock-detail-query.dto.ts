import { IsUUID } from 'class-validator';

export class StockDetailQueryDto {
  @IsUUID()
  articleId: string;

  @IsUUID()
  siteId: string;
}
