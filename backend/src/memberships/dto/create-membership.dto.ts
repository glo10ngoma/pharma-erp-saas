import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMembershipDto {
  @ApiProperty() @IsUUID() customerId: string;
  @ApiProperty() @IsUUID() organizationId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() planId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() memberNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeNumber?: string;
  @ApiPropertyOptional({ enum: ['MAIN', 'DEPENDENT', 'EMPLOYEE', 'OTHER'] }) @IsOptional() @IsIn(['MAIN', 'DEPENDENT', 'EMPLOYEE', 'OTHER']) relationshipType?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
