import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterPosWorkstationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  deviceId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  workstationName: string;

  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

