import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreatePurchaseDto {
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
