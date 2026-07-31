import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AddPurchaseReturnReplacementItemDto {
  @IsUUID()
  articleId!: string;

  @IsOptional()
  @IsUUID()
  purchaseUnitId?: string;

  @IsNumber()
  @Min(0.001)
  receivedPurchaseQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  conversionFactor?: number;

  @IsOptional()
  @IsUUID()
  stockUnitId?: string;

  @IsString()
  @MaxLength(100)
  lotNumber!: string;

  @IsDateString()
  expiryDate!: string;

  @IsNumber()
  @Min(0)
  unitValue!: number;
}
