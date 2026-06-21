import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'KIN-01' })
  @IsString()
  siteCode: string;

  @ApiProperty({ example: 'Pharmacie Kinshasa Centre' })
  @IsString()
  siteName: string;

  @ApiProperty({ enum: ['PHARMACY', 'WAREHOUSE', 'OFFICE', 'OTHER'] })
  @IsIn(['PHARMACY', 'WAREHOUSE', 'OFFICE', 'OTHER'])
  siteType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
