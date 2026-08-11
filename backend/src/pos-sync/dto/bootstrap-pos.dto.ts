import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class BootstrapPosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;
}

