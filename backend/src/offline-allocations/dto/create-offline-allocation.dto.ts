import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateOfflineAllocationDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty()
  @IsUUID()
  workstationId!: string;

  @ApiProperty()
  @IsUUID()
  articleId!: string;

  @ApiProperty()
  @IsUUID()
  lotId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  expectedServerVersion?: number;
}
