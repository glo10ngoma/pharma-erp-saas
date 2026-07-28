import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListStockSummaryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['ALL', 'AVAILABLE', 'LOW', 'OUT', 'RESERVED'])
  status: 'ALL' | 'AVAILABLE' | 'LOW' | 'OUT' | 'RESERVED' = 'ALL';

  @IsOptional()
  @IsIn(['ALL', 'EXPIRED', 'UNDER_30', 'UNDER_90', 'VALID'])
  expiryStatus: 'ALL' | 'EXPIRED' | 'UNDER_30' | 'UNDER_90' | 'VALID' = 'ALL';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
