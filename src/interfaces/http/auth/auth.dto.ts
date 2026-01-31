import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
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

  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @Length(1, 100)
  lastname: string;
}
