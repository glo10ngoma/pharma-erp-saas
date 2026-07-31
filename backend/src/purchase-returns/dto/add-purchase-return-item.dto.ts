import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AddPurchaseReturnItemDto {
  @IsUUID()
  purchaseItemId!: string;

  @IsUUID()
  articleId!: string;

  @IsUUID()
  lotId!: string;

  @IsNumber()
  @Min(0.001)
  @Max(999999999)
  returnedPurchaseQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  returnUnitValue?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  @IsIn(['GOOD', 'DAMAGED', 'EXPIRED', 'NON_COMPLIANT', 'WRONG_PRODUCT', 'OTHER'])
  conditionStatus?: 'GOOD' | 'DAMAGED' | 'EXPIRED' | 'NON_COMPLIANT' | 'WRONG_PRODUCT' | 'OTHER';
}
