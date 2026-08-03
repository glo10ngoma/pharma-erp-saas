import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class AddCustomerReturnReplacementItemDto {
  @IsUUID()
  articleId!: string;

  @IsOptional()
  @IsUUID()
  salesUnitId?: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}
