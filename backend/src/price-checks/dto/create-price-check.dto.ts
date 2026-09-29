import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreatePriceCheckItemDto {
  @IsOptional()
  @IsUUID()
  articleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  manualDescription?: string;

  @IsNumber()
  @Min(0.001)
  requestedQuantity: number;
}

export class CreatePriceCheckDto {
  @IsUUID()
  siteId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  patientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePriceCheckItemDto)
  items: CreatePriceCheckItemDto[];
}
