import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListOfflineAllocationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  articleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'EXHAUSTED', 'SUSPENDED', 'REVOKED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'EXHAUSTED', 'SUSPENDED', 'REVOKED'])
  status?: 'ACTIVE' | 'EXHAUSTED' | 'SUSPENDED' | 'REVOKED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
