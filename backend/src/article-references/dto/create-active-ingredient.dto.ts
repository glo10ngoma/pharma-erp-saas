import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateActiveIngredientDto {
  @ApiProperty({ example: 'Paracetamol' })
  @IsString()
  canonicalName: string;
}
