import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty({ example: 'ART-000001' })
  @IsString()
  articleCode: string;

  @ApiProperty({ example: 'Paracetamol 500 mg' })
  @IsString()
  commercialName: string;

  @ApiPropertyOptional({ example: 'Paracetamol' })
  @IsOptional()
  @IsString()
  dci?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dciId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @IsOptional()
  @IsUUID()
  formId?: string;

  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  productTypeId?: string;

  @ApiPropertyOptional({ example: '500 mg' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  dosageId?: string;

  @ApiPropertyOptional({ example: 'N02BE01' })
  @IsOptional()
  @IsString()
  atcCode?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  atcId?: string;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @ApiPropertyOptional({ example: 'PLAQ' })
  @IsOptional()
  @IsUUID()
  salesUnitId?: string;

  @ApiPropertyOptional({ example: 'BOX' })
  @IsOptional()
  @IsUUID()
  packagingUnitId?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  unitsPerPackage?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultStockMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultStockMax?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
