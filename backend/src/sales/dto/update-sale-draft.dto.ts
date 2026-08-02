import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UpdateSaleDraftDto {
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @IsOptional()
  @IsEnum(['CASH', 'INSURANCE'])
  saleType?: 'CASH' | 'INSURANCE';

  @IsOptional()
  @IsEnum(['IMMEDIATE', 'ADVANCE'])
  saleMode?: 'IMMEDIATE' | 'ADVANCE';
}
