import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateWorkstationDto {
  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  workstationCode: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  workstationName: string;

  @ApiPropertyOptional({ enum: ['POS', 'BACK_OFFICE', 'LAB', 'OFFICE', 'OTHER'] })
  @IsOptional()
  @IsEnum(['POS', 'BACK_OFFICE', 'LAB', 'OFFICE', 'OTHER'])
  workstationType?: 'POS' | 'BACK_OFFICE' | 'LAB' | 'OFFICE' | 'OTHER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceUuid?: string;
}
