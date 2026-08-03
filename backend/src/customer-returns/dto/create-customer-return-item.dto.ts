import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateCustomerReturnItemDto {
  @IsUUID()
  articleId!: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsIn(['GOOD', 'OPENED', 'DAMAGED', 'EXPIRED', 'WRONG_PRODUCT', 'OTHER'])
  condition?: 'GOOD' | 'OPENED' | 'DAMAGED' | 'EXPIRED' | 'WRONG_PRODUCT' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
