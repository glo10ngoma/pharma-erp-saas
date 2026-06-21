import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AddInventoryItemDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty()
  @IsUUID()
  lotId: string;

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
