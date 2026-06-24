import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  siteId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsEnum(['CASH', 'CUSTOMER_CREDIT', 'ORGANIZATION_CREDIT', 'INSURANCE'])
  saleType?: 'CASH' | 'INSURANCE';
}
