import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListPosSyncAdminDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @ApiPropertyOptional({ enum: ['ONLINE', 'OFFLINE', 'DEGRADED', 'STALE', 'REVOKED'] })
  @IsOptional()
  @IsIn(['ONLINE', 'OFFLINE', 'DEGRADED', 'STALE', 'REVOKED'])
  status?: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'STALE' | 'REVOKED';

  @ApiPropertyOptional({ enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'])
  conflictStatus?: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

  @ApiPropertyOptional({ enum: ['INFO', 'WARNING', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['INFO', 'WARNING', 'CRITICAL'])
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
