import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateProductUnitDto {
  @ApiProperty({ example: 'BOX' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(40)
  unitCode: string;

  @ApiProperty({ example: 'Boite' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  unitLabel: string;
}
