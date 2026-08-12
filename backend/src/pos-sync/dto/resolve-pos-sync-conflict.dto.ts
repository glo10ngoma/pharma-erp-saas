import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ResolvePosSyncConflictDto {
  @ApiProperty({
    enum: [
      'UNDER_REVIEW',
      'MANUAL_REVIEW_COMPLETED',
      'DISMISS',
      'CANCEL_SYNC_OPERATION',
      'REASSIGN_CASH_SESSION',
    ],
  })
  @IsIn([
    'UNDER_REVIEW',
    'MANUAL_REVIEW_COMPLETED',
    'DISMISS',
    'CANCEL_SYNC_OPERATION',
    'REASSIGN_CASH_SESSION',
  ])
  resolutionType:
    | 'UNDER_REVIEW'
    | 'MANUAL_REVIEW_COMPLETED'
    | 'DISMISS'
    | 'CANCEL_SYNC_OPERATION'
    | 'REASSIGN_CASH_SESSION';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetCashSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
