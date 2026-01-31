import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "@/application/auth/auth.service";
import { RequestOtpDto, VerifyOtpDto } from "./auth.dto";

@Controller('auth/register/')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.email);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtpAndCreateUser(dto);
  }
}