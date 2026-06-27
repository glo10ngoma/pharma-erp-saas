import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateExchangeRateDto {
  @ApiProperty({ example: 2850, minimum: 0.0001 })
  @IsNumber()
  @Min(0.0001)
  rate: number;
}
