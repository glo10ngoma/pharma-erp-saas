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

  @IsOptional()
  @IsNumber()
  suggestedChangeUsd?: number;

  @IsOptional()
  @IsNumber()
  suggestedChangeCdf?: number;

  @IsOptional()
  @IsNumber()
  netTotalEquivalentUsd?: number;

  @IsOptional()
  @IsNumber()
  settlementDifferenceUsd?: number;
}

export class SubmitPosSaleValidateOperationDto {
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

  @IsOptional()
  @IsUUID()
  cashSessionId?: string | null;

  @IsUUID()
  localCashSessionId: string;

  @IsOptional()
  @IsUUID()
  cashSessionOpenOperationId?: string | null;

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

  @IsEnum(['IMMEDIATE', 'ADVANCE'])
  saleMode: 'IMMEDIATE' | 'ADVANCE';

  @IsEnum(['CASH', 'INSURANCE'])
  saleType: 'CASH' | 'INSURANCE';

  @IsOptional()
  @IsUUID()
  organizationId?: string | null;

  @IsOptional()
  @IsUUID()
  planId?: string | null;

  @IsOptional()
  @IsUUID()
  membershipId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coveragePercentSnapshot?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  patientShareUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  insuranceShareUsd?: number;

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

export class SubmitPosCashSessionOpenOperationDto {
  @ApiProperty({ enum: ['CASH_SESSION_OPEN'] })
  @IsEnum(['CASH_SESSION_OPEN'])
  operationType: 'CASH_SESSION_OPEN';

  @IsUUID()
  operationId: string;

  @IsUUID()
  localCashSessionId: string;

  @IsString()
  offlineCashReference: string;

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

  @IsNumber()
  @Min(0)
  openingBalanceUsd: number;

  @IsNumber()
  @Min(0)
  openingBalanceCdf: number;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsString()
  openedLocallyAt: string;
}

export class SubmitPosCashExpenseOperationDto {
  @ApiProperty({ enum: ['CASH_EXPENSE'] })
  @IsEnum(['CASH_EXPENSE'])
  operationType: 'CASH_EXPENSE';

  @IsUUID()
  operationId: string;

  @IsUUID()
  localCashSessionId: string;

  @IsString()
  offlineCashReference: string;

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

  @IsOptional()
  @IsUUID()
  serverCashSessionId?: string | null;

  @IsOptional()
  @IsUUID()
  cashSessionOpenOperationId?: string | null;

  @IsUUID()
  localMovementId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(['USD', 'CDF'])
  currency: 'USD' | 'CDF';

  @IsString()
  expenseCategory: string;

  @IsString()
  description: string;

  @IsString()
  createdLocallyAt: string;
}

export class SubmitPosCashSessionCloseOperationDto {
  @ApiProperty({ enum: ['CASH_SESSION_CLOSE'] })
  @IsEnum(['CASH_SESSION_CLOSE'])
  operationType: 'CASH_SESSION_CLOSE';

  @IsUUID()
  operationId: string;

  @IsUUID()
  localCashSessionId: string;

  @IsString()
  offlineCashReference: string;

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

  @IsOptional()
  @IsUUID()
  serverCashSessionId?: string | null;

  @IsOptional()
  @IsUUID()
  cashSessionOpenOperationId?: string | null;

  @IsNumber()
  @Min(0)
  declaredClosingUsd: number;

  @IsNumber()
  @Min(0)
  declaredClosingCdf: number;

  @IsNumber()
  @Min(0)
  expectedClosingUsd: number;

  @IsNumber()
  @Min(0)
  expectedClosingCdf: number;

  @IsNumber()
  differenceUsd: number;

  @IsNumber()
  differenceCdf: number;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsString()
  closedLocallyAt: string;
}

export class SubmitPosOperationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitPosSaleValidateOperationDto, {
    discriminator: {
      property: 'operationType',
      subTypes: [
        { name: 'SALE_VALIDATE', value: SubmitPosSaleValidateOperationDto },
        { name: 'CASH_SESSION_OPEN', value: SubmitPosCashSessionOpenOperationDto },
        { name: 'CASH_EXPENSE', value: SubmitPosCashExpenseOperationDto },
        { name: 'CASH_SESSION_CLOSE', value: SubmitPosCashSessionCloseOperationDto },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  operations: Array<
    | SubmitPosSaleValidateOperationDto
    | SubmitPosCashSessionOpenOperationDto
    | SubmitPosCashExpenseOperationDto
    | SubmitPosCashSessionCloseOperationDto
  >;
}

export type SubmitPosSaleValidateOperation = SubmitPosSaleValidateOperationDto;
export type SubmitPosCashSessionOpenOperation = SubmitPosCashSessionOpenOperationDto;
export type SubmitPosCashExpenseOperation = SubmitPosCashExpenseOperationDto;
export type SubmitPosCashSessionCloseOperation = SubmitPosCashSessionCloseOperationDto;
export type SubmitPosOperation =
  | SubmitPosSaleValidateOperation
  | SubmitPosCashSessionOpenOperation
  | SubmitPosCashExpenseOperation
  | SubmitPosCashSessionCloseOperation;
