import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class InspectCustomerReturnDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
