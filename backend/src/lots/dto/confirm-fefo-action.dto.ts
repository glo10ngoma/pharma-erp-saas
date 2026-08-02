import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ConfirmFefoActionDto {
  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ enum: ['HIGHLIGHT_CONFIRMED', 'SHELF_ROTATION_CONFIRMED'] })
  @IsIn(['HIGHLIGHT_CONFIRMED', 'SHELF_ROTATION_CONFIRMED'])
  actionType: 'HIGHLIGHT_CONFIRMED' | 'SHELF_ROTATION_CONFIRMED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requestKey?: string;
}
