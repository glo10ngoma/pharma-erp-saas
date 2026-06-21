import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'users.read' })
  @IsString()
  permissionCode: string;

  @ApiProperty({ example: 'Consulter utilisateurs' })
  @IsString()
  permissionName: string;

  @ApiProperty({ example: 'Users' })
  @IsString()
  moduleName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSystemPermission?: boolean;
}
