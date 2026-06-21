import { IsNumber, IsUUID, Min } from 'class-validator';

export class AddSaleItemFefoDto {
  @IsUUID()
  articleId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}
