import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AddPurchaseReturnSettlementDto {
  @IsString()
  @IsIn(['REFUND', 'ADDITIONAL_PAYMENT', 'SUPPLIER_CREDIT'])
  settlementKind!: 'REFUND' | 'ADDITIONAL_PAYMENT' | 'SUPPLIER_CREDIT';

  @IsString()
  @IsIn(['CASH_REGISTER', 'BANK', 'MOBILE_MONEY', 'SUPPLIER_CREDIT', 'OTHER'])
  paymentSource!: 'CASH_REGISTER' | 'BANK' | 'MOBILE_MONEY' | 'SUPPLIER_CREDIT' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  exchangeRateApplied?: number;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
