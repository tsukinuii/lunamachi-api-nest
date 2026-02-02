import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '@/application/auth/auth.service';
import {
  RequestOtpDto,
  VerifyOtpDto,
  LoginDto,
  SocialExchangeDto,
} from './auth.dto';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '@/domain/auth/user-role';
import { ScopesGuard } from './scopes.guard';
import { RequireScopes } from './scopes.decorator';
import { Scopes } from '@/domain/auth/scopes';
import { RefreshCsrfGuard } from './refresh-csrf.guard';

@Controller('auth/')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/request-otp')
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.email);
  }

  @Post('register/verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtpAndCreateUser(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, req, res);
  }

  @UseGuards(RefreshCsrfGuard)
  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(req, res);
  }

  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(req, res);
  }

  @Post('social/exchange')
  socialExchange(
    @Body() dto: SocialExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.socialExchange(dto, req, res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin-only')
  adminOnly() {
    return { message: 'admin ok' };
  }

  @UseGuards(JwtAuthGuard, ScopesGuard)
  @RequireScopes(Scopes.ORDERS_READ_ANY)
  @Get('orders/all')
  listAllOrders() {
    return { ok: true };
  }
}
