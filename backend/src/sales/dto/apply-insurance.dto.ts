import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ApplyInsuranceDto {
  @ApiProperty() @IsUUID() membershipId: string;
}
