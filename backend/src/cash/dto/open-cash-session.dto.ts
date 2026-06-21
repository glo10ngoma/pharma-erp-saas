import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class OpenCashSessionDto {
  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  openingBalance: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cashRegisterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
