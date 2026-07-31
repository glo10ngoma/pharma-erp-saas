import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

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
  @IsUUID()
  workstationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceUuid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
