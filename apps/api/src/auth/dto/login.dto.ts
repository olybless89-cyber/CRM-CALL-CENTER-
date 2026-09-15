import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({
    required: false,
    description: 'Required if the same email is registered under more than one tenant.',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
