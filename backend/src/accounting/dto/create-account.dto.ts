import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty()
  @IsString()
  accountCode: string;

  @ApiProperty()
  @IsString()
  accountName: string;

  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
