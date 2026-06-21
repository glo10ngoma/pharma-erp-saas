import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PayReceivableDto {
  @ApiProperty() @IsNumber() @Min(0.01) amount: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentMethodId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referencePayment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
