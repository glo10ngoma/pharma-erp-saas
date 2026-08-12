import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class RebalanceOfflineAllocationsDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty()
  @IsUUID()
  articleId!: string;

  @ApiProperty()
  @IsUUID()
  lotId!: string;

  @ApiProperty({ enum: ['AUTOMATIC_EQUAL'] })
  @IsIn(['AUTOMATIC_EQUAL'])
  mode!: 'AUTOMATIC_EQUAL';

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  workstationIds!: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantityToAllocate?: number;
}
