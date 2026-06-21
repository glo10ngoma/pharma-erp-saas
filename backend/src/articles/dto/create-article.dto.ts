import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  articleCode: string;

  @IsString()
  commercialName: string;

  @IsOptional()
  @IsString()
  dci?: string;

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

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  atcCode?: string;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

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
}
