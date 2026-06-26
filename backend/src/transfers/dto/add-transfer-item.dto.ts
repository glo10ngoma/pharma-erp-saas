import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AddTransferItemDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty()
  @IsUUID()
  lotId: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
