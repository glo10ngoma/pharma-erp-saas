import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  title: string;

  @ApiPropertyOptional({ enum: ['DIRECT', 'GROUP', 'SITE', 'SYSTEM'] })
  @IsOptional()
  @IsEnum(['DIRECT', 'GROUP', 'SITE', 'SYSTEM'])
  threadType?: 'DIRECT' | 'GROUP' | 'SITE' | 'SYSTEM';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  participantIds?: string[];
}
