import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Agent Demo' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'agent.demo' })
  @IsString()
  username: string;

  @ApiPropertyOptional({ example: 'agent@demo.local' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsUUID()
  roleId: string;

  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
