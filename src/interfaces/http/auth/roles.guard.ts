import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '@/domain/auth/user-role';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // ไม่มี @Roles => ผ่าน (ให้ JwtAuthGuard เป็นคนกัน auth)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { role?: string };

    if (!user?.role) throw new ForbiddenException('Missing role');

    const ok = requiredRoles.includes(user.role as UserRole);
    if (!ok) throw new ForbiddenException('Insufficient role');

    return true;
  }
}