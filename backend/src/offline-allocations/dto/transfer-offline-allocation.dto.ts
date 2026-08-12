import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class TransferOfflineAllocationDto {
  @ApiProperty()
  @IsUUID()
  sourceWorkstationId!: string;

  @ApiProperty()
  @IsUUID()
  targetWorkstationId!: string;

  @ApiProperty()
  @IsUUID()
  allocationId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}
