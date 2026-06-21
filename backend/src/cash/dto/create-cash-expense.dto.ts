import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCashExpenseDto {
  @ApiProperty()
  @IsUUID()
  cashSessionId: string;

  @ApiProperty()
  @IsString()
  expenseCategory: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}
