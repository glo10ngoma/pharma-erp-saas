import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateAtcCodeDto {
  @ApiProperty({ example: 'N02BE01' })
  @IsString()
  atcCode: string;

  @ApiProperty({ example: 'Paracetamol' })
  @IsString()
  atcLabel: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ example: 'N02BE' })
  @IsOptional()
  @IsString()
  parentCode?: string;
}
