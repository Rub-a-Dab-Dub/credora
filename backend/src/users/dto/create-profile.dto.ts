import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  fullName: string;

  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  walletAddress?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;
}
