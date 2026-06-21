import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'SUP-001' })
  @IsString()
  supplierCode: string;

  @ApiProperty({ example: 'Fournisseur Demo' })
  @IsString()
  supplierName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rccm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nif?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
