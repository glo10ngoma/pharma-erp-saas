import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTransferDto {
  @ApiPropertyOptional({ example: 'TRF-000001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  transferNumber?: string;

  @ApiProperty()
  @IsUUID()
  fromSiteId: string;

  @ApiProperty()
  @IsUUID()
  toSiteId: string;

  @ApiPropertyOptional({ example: '2026-06-26' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
