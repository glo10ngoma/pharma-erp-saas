import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateInsurancePlanDto {
  @ApiProperty() @IsUUID() organizationId: string;
  @ApiProperty() @IsString() planCode: string;
  @ApiProperty() @IsString() planName: string;
  @ApiProperty({ minimum: 0, maximum: 100 }) @IsNumber() @Min(0) @Max(100) coveragePercent: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @IsOptional() @IsNumber() @Min(0) @Max(100) patientCopayPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) monthlyLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) annualLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresAuthorization?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
