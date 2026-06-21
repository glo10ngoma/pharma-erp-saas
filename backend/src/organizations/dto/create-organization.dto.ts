import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  organizationCode: string;

  @ApiProperty()
  @IsString()
  organizationName: string;

  @ApiProperty({ enum: ['COMPANY', 'INSURANCE', 'NGO', 'HOSPITAL', 'CLINIC', 'CHURCH', 'GOVERNMENT', 'OTHER'] })
  @IsIn(['COMPANY', 'INSURANCE', 'NGO', 'HOSPITAL', 'CLINIC', 'CHURCH', 'GOVERNMENT', 'OTHER'])
  organizationType: string;

  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rccm?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nif?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() creditAllowed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) paymentTermsDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
