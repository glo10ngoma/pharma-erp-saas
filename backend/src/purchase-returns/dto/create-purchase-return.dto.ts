import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePurchaseReturnDto {
  @IsUUID()
  purchaseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  returnNumber?: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['REFUND', 'CREDIT_NOTE', 'EXCHANGE', 'MIXED'])
  returnType?: 'REFUND' | 'CREDIT_NOTE' | 'EXCHANGE' | 'MIXED';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  exchangeRateApplied?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
