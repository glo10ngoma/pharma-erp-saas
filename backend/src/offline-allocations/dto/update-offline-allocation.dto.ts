import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateOfflineAllocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  allocatedQuantity?: number;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'EXHAUSTED', 'SUSPENDED', 'REVOKED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'EXHAUSTED', 'SUSPENDED', 'REVOKED'])
  status?: 'ACTIVE' | 'EXHAUSTED' | 'SUSPENDED' | 'REVOKED';
}
