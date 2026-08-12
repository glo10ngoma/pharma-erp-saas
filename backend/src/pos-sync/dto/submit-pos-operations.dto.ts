import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class SubmitPosSaleLotAllocationDto {
  @IsUUID()
  allocationId: string;

  @IsUUID()
  lotId: string;

  @IsString()
  lotNumber: string;

  @IsString()
  expiryDate: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  allocationServerVersion: number;
}

class SubmitPosSaleItemDto {
  @IsUUID()
  articleId: string;

  @IsString()
  articleCode: string;

  @IsString()
  articleName: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPriceSnapshot: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitPosSaleLotAllocationDto)
  lotAllocations: SubmitPosSaleLotAllocationDto[];
}

class SubmitPosPaymentDto {
  @IsNumber()
  @Min(0)
  amountPaidUsd: number;

  @IsNumber()
  @Min(0)
  amountPaidCdf: number;

  @IsNumber()
  @Min(0)
  amountReturnedUsd: number;

  @IsNumber()
  @Min(0)
  amountReturnedCdf: number;

  @IsNumber()
  netReceivedUsd: number;

  @IsNumber()
  netReceivedCdf: number;
}

class SubmitPosSaleValidateOperationDto {
  @ApiProperty({ enum: ['SALE_VALIDATE'] })
  @IsEnum(['SALE_VALIDATE'])
  operationType: 'SALE_VALIDATE';

  @IsUUID()
  operationId: string;

  @IsUUID()
  localSaleId: string;

  @IsString()
  offlineReference: string;

  @IsUUID()
  tenantId: string;

  @IsUUID()
  siteId: string;

  @IsUUID()
  workstationId: string;

  @IsString()
  deviceId: string;

  @IsUUID()
  userId: string;

  @IsUUID()
  cashSessionId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @IsEnum(['USD'])
  currency: 'USD';

  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRateSnapshot?: number | null;

  @IsString()
  createdAt: string;

  @IsString()
  validatedAt: string;

  @IsEnum(['IMMEDIATE'])
  saleMode: 'IMMEDIATE';

  @IsEnum(['CASH'])
  saleType: 'CASH';

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @Min(0)
  total: number;

  @ValidateNested()
  @Type(() => SubmitPosPaymentDto)
  payment: SubmitPosPaymentDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitPosSaleItemDto)
  items: SubmitPosSaleItemDto[];
}

export class SubmitPosOperationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitPosSaleValidateOperationDto)
  operations: SubmitPosSaleValidateOperationDto[];
}

export type SubmitPosSaleValidateOperation = SubmitPosSaleValidateOperationDto;
