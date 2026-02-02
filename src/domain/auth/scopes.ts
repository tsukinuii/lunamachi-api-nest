import { UserRole } from '@/domain/auth/user-role';

export const Scopes = {
  PROFILE_READ_OWN: 'profile:read:own',
  PROFILE_WRITE_OWN: 'profile:write:own',

  ORDERS_READ_OWN: 'orders:read:own',
  ORDERS_READ_ANY: 'orders:read:any',

  PAYMENTS_READ_ANY: 'payments:read:any',

  PRODUCTS_WRITE: 'products:write',
  USERS_SUSPEND: 'users:suspend',
} as const;

export type Scope = (typeof Scopes)[keyof typeof Scopes];

export const ROLE_SCOPES: Record<UserRole, Scope[]> = {
  [UserRole.USER]: [
    Scopes.PROFILE_READ_OWN,
    Scopes.PROFILE_WRITE_OWN,
    Scopes.ORDERS_READ_OWN,
  ],
  [UserRole.STAFF]: [
    Scopes.PROFILE_READ_OWN,
    Scopes.PROFILE_WRITE_OWN,
    Scopes.ORDERS_READ_ANY,
  ],
  [UserRole.ADMIN]: [
    Scopes.PROFILE_READ_OWN,
    Scopes.PROFILE_WRITE_OWN,
    Scopes.ORDERS_READ_ANY,
    Scopes.PAYMENTS_READ_ANY,
    Scopes.PRODUCTS_WRITE,
    Scopes.USERS_SUSPEND,
  ],
};
