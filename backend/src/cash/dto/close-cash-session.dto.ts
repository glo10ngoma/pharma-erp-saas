import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseCashSessionDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  countedClosingBalance: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
