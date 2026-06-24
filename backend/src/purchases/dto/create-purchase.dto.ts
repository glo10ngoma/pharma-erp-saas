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

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: '2026-06-19' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;
}
