import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateProductUnitDto {
  @ApiProperty({ example: 'BOX' })
  @IsString()
  unitCode: string;

  @ApiProperty({ example: 'Boite' })
  @IsString()
  unitLabel: string;
}
