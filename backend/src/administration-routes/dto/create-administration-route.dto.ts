import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateAdministrationRouteDto {
  @ApiProperty({ example: 'ORAL' })
  @IsString()
  routeCode: string;

  @ApiProperty({ example: 'Voie orale' })
  @IsString()
  routeName: string;
}
