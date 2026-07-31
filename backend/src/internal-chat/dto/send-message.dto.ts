import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  messageText: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'NOTICE', 'TEAM', 'SYSTEM'] })
  @IsOptional()
  @IsEnum(['TEXT', 'NOTICE', 'TEAM', 'SYSTEM'])
  messageType?: 'TEXT' | 'NOTICE' | 'TEAM' | 'SYSTEM';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workstationId?: string;
}
