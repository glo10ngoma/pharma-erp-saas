import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { ListStockSummaryDto } from './list-stock-summary.dto';

export class ListStockAsOfDto extends ListStockSummaryDto {
  @IsDateString()
  stockDate!: string;

  @IsOptional()
  @IsIn(['ALL', 'AVAILABLE', 'LOW', 'OUT', 'RESERVED'])
  status: 'ALL' | 'AVAILABLE' | 'LOW' | 'OUT' | 'RESERVED' = 'ALL';
}
