import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  siteId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsUUID()
  currencyId: string;

  @IsOptional()
  @IsEnum(['CASH', 'CUSTOMER_CREDIT', 'ORGANIZATION_CREDIT', 'INSURANCE'])
  saleType?: 'CASH' | 'INSURANCE';
}
