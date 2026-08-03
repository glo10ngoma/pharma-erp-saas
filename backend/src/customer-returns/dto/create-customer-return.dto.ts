import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCustomerReturnDto {
  @IsUUID()
  saleId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  returnNumber?: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
