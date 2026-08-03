import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AddCustomerReturnItemDto {
  @IsUUID()
  saleItemId!: string;

  @IsNumber()
  @Min(0.001)
  returnedQuantity!: number;

  @IsOptional()
  @IsString()
  @IsIn(['GOOD', 'OPENED', 'DAMAGED', 'EXPIRED', 'WRONG_PRODUCT', 'OTHER'])
  conditionStatus?: 'GOOD' | 'OPENED' | 'DAMAGED' | 'EXPIRED' | 'WRONG_PRODUCT' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
