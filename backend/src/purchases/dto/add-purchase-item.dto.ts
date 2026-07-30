import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AddPurchaseItemDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ example: 'LOT-2026-001' })
  @IsString()
  lotNumber: string;

  @ApiProperty({ example: '2027-12-31' })
  @IsDateString()
  expiryDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purchaseUnitLabelSnapshot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  purchaseQuantity?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  conversionFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stockUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stockUnitLabelSnapshot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  stockQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  lineOrder?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  purchaseUnitPrice: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  sellingUnitPrice: number;
}
