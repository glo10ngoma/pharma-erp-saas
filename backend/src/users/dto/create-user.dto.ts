import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Agent Demo' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'Agent' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Demo' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'Kabasele' })
  @IsOptional()
  @IsString()
  postName?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  @ApiPropertyOptional({ example: '1990-01-31' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ example: 'Pharmacien' })
  @IsString()
  jobTitle: string;

  @ApiPropertyOptional({ example: 'EMP-0001' })
  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @ApiPropertyOptional({ example: 'Officine' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ example: 'agent.demo' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'agent@demo.local' })
  @IsEmail()
  email: string;

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
