import { Type } from 'class-transformer';
import { ValidateNested, IsArray, ArrayMinSize, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { CreateCustomerReturnItemDto } from './create-customer-return-item.dto';

export class CreateCustomerReturnDto {
  @IsOptional()
  @IsIn(['LINKED', 'PROBABLE', 'UNLINKED'])
  saleLinkStatus?: 'LINKED' | 'PROBABLE' | 'UNLINKED';

  @ValidateIf((dto) => dto.saleLinkStatus !== 'UNLINKED')
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsUUID()
  probableSaleId?: string;

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

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @IsString()
  @MaxLength(255)
  declaredCustomerName?: string;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @IsString()
  @MaxLength(80)
  declaredCustomerPhone?: string;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @IsUUID()
  declaredArticleId?: string;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  declaredQuantity?: number;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @IsString()
  @MaxLength(100)
  declaredLotNumber?: string;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @IsDateString()
  declaredExpiryDate?: string;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @IsDateString()
  approximatePurchaseDate?: string;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @IsUUID()
  supposedSiteId?: string;

  @ValidateIf((dto) => dto.saleLinkStatus === 'UNLINKED')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  declaredPrice?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerReturnItemDto)
  items?: CreateCustomerReturnItemDto[];

  @IsOptional()
  @IsIn(['PHARMACY_ERROR', 'CUSTOMER_ERROR', 'SUPPLIER_DEFECT', 'OTHER'])
  responsibilityOrigin?: 'PHARMACY_ERROR' | 'CUSTOMER_ERROR' | 'SUPPLIER_DEFECT' | 'OTHER';

  @IsOptional()
  @IsIn(['ACCEPTED_WITH_RESERVE', 'REFUSED', 'INSPECTION_REQUIRED'])
  commercialDecision?: 'ACCEPTED_WITH_RESERVE' | 'REFUSED' | 'INSPECTION_REQUIRED';
}
