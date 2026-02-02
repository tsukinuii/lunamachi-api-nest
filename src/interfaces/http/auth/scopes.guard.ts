import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_SCOPES, Scope } from '@/domain/auth/scopes';
import { UserRole } from '@/domain/auth/user-role';
import { SCOPES_KEY } from './scopes.decorator';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Scope[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { role?: UserRole };

    if (!user?.role) throw new ForbiddenException('Missing role');

    const userScopes = ROLE_SCOPES[user.role] ?? [];
    const ok = required.every((s) => userScopes.includes(s));

    if (!ok) throw new ForbiddenException('Insufficient scope');

    return true;
  }
}
