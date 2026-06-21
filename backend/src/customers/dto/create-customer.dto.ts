import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'CLI-001' })
  @IsString()
  customerCode: string;

  @ApiProperty({ example: 'Client Demo' })
  @IsString()
  customerName: string;

  @ApiPropertyOptional({ enum: ['INDIVIDUAL', 'COMPANY_EMPLOYEE', 'COMPANY', 'HOSPITAL', 'NGO', 'INSURANCE_MEMBER', 'OTHER'] })
  @IsOptional()
  @IsIn(['INDIVIDUAL', 'COMPANY_EMPLOYEE', 'COMPANY', 'HOSPITAL', 'NGO', 'INSURANCE_MEMBER', 'OTHER'])
  customerType?: string;

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  creditAllowed?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
