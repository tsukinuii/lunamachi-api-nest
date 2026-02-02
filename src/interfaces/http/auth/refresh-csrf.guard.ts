import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshCsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & any>();

    // 1) เช็ค Origin (สำคัญสุด)
    const origin = (req.headers as any).origin as string | undefined;
    console.log('Origin::', origin);

    const allow = (this.config.get<string>('CORS_ORIGINS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log('Allowed origins::', allow);

    if (!origin || !allow.includes(origin)) {
      throw new UnauthorizedException({
        code: 'CSRF_ORIGIN_BLOCKED',
        message: 'Invalid origin',
      });
    }

    // 2) บังคับ header เฉพาะ (กัน CSRF แบบพื้นฐาน)
    const marker = (req.headers as any)['x-csrf'] as string | undefined;
    if (!marker || marker !== '1') {
      throw new UnauthorizedException({
        code: 'CSRF_HEADER_MISSING',
        message: 'Missing CSRF header',
      });
    }

    return true;
  }
}