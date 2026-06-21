import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateJournalDto {
  @ApiProperty()
  @IsString()
  journalCode: string;

  @ApiProperty()
  @IsString()
  journalName: string;

  @ApiProperty({ enum: ['SALES', 'PURCHASES', 'CASH', 'BANK', 'GENERAL', 'INVENTORY'] })
  @IsIn(['SALES', 'PURCHASES', 'CASH', 'BANK', 'GENERAL', 'INVENTORY'])
  journalType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
