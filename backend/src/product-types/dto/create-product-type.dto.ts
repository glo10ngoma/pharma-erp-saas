import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateProductTypeDto {
  @ApiProperty({ example: 'MED' })
  @IsString()
  typeCode: string;

  @ApiProperty({ example: 'Medicament' })
  @IsString()
  typeName: string;
}
