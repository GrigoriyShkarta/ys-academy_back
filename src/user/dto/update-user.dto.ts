import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  telegram?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  birthDate?: string;

  @IsOptional()
  @IsString()
  musicLevel?: string;

  @IsOptional()
  @IsString()
  vocalExperience?: string;

  @IsOptional()
  @IsString()
  goals?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  accessExpiryDate?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  deactivationDate?: string;
}
