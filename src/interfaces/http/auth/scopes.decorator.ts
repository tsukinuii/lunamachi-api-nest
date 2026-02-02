import { SetMetadata } from '@nestjs/common';
import { Scope } from '@/domain/auth/scopes';

export const SCOPES_KEY = 'scopes';
export const RequireScopes = (...scopes: Scope[]) =>
  SetMetadata(SCOPES_KEY, scopes);
