import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class AddPurchaseItemDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ example: 'LOT-2026-001' })
  @IsString()
  lotNumber: string;

  @ApiProperty({ example: '2027-12-31' })
  @IsDateString()
  expiryDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  purchaseUnitPrice: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  sellingUnitPrice: number;
}
