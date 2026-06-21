import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateGalenicFormDto {
  @ApiProperty({ example: 'TAB' })
  @IsString()
  formCode: string;

  @ApiProperty({ example: 'Comprime' })
  @IsString()
  formName: string;
}
