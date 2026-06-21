import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiPropertyOptional({ enum: ['FULL', 'PARTIAL', 'CATEGORY', 'SENSITIVE_PRODUCTS', 'CONTROL'] })
  @IsOptional()
  @IsIn(['FULL', 'PARTIAL', 'CATEGORY', 'SENSITIVE_PRODUCTS', 'CONTROL'])
  inventoryType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  inventoryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
