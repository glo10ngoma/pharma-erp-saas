import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateWorkstationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workstationCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workstationName?: string;

  @ApiPropertyOptional({ enum: ['POS', 'BACK_OFFICE', 'LAB', 'OFFICE', 'OTHER'] })
  @IsOptional()
  @IsEnum(['POS', 'BACK_OFFICE', 'LAB', 'OFFICE', 'OTHER'])
  workstationType?: 'POS' | 'BACK_OFFICE' | 'LAB' | 'OFFICE' | 'OTHER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceUuid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
