import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class ConfirmPickupItemDto {
  @IsUUID()
  saleItemId: string;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.001)
  quantity: number;
}

export class ConfirmPickupDto {
  @IsOptional()
  @IsString()
  requestKey?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmPickupItemDto)
  items?: ConfirmPickupItemDto[];
}
