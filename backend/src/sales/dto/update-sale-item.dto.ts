import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateSaleItemDto {
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.001)
  quantity!: number;
}
