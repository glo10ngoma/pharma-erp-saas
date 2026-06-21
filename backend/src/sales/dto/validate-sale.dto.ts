import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ValidateSaleDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  amountPaid: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencePayment?: string;
}
