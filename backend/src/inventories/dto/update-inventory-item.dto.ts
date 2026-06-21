import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateInventoryItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  physicalQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
