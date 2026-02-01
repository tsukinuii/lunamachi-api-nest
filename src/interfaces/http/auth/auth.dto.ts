import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsString,
  Length,
  IsOptional,
  IsIn,
} from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumberString()
  @Length(6, 6)
  otp: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  username: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  lastname: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  password: string;
}

export class SocialExchangeDto {
  @IsIn(['google', 'facebook', 'github'])
  provider: 'google' | 'facebook' | 'github';

  @IsString()
  @IsNotEmpty()
  accessToken: string;
}