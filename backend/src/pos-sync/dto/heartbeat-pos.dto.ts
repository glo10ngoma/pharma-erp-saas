import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class HeartbeatPosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  appVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localDbVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  syncCursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  pendingCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  conflictCount?: number;

  @ApiPropertyOptional({ enum: ['FRESH', 'STALE', 'EXPIRED', 'REVOKED', 'UNKNOWN'] })
  @IsOptional()
  @IsIn(['FRESH', 'STALE', 'EXPIRED', 'REVOKED', 'UNKNOWN'])
  snapshotStatus?: 'FRESH' | 'STALE' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastSyncAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastSuccessfulSyncAt?: string;
}
