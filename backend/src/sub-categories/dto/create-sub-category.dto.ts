import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSubCategoryDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'PARA' })
  @IsString()
  subCategoryCode: string;

  @ApiProperty({ example: 'Paracetamol' })
  @IsString()
  subCategoryName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
