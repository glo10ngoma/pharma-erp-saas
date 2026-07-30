import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePurchaseDto {
  @ApiPropertyOptional({ example: 'ACH-000001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  purchaseNumber?: string;

  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: '2026-06-19' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional({ enum: ['CASH_REGISTER', 'BANK', 'MOBILE_MONEY', 'CREDIT', 'OTHER'] })
  @IsOptional()
  @IsString()
  paymentSource?: string;

  @ApiPropertyOptional({ enum: ['CASH', 'BANK_TRANSFER', 'CARD', 'MOBILE_MONEY', 'CREDIT', 'MIXED', 'OTHER'] })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaidUsd?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaidCdf?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentNote?: string;
}
