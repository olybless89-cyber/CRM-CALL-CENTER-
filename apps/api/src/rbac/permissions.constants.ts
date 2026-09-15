/**
 * Mirrors the permission keys seeded by prisma/seed.ts. Kept as constants
 * so controllers reference a typed value instead of a raw string that
 * could typo silently.
 */
export const PERMISSIONS = {
  TENANTS_CREATE: 'tenants:create',
  TENANTS_READ: 'tenants:read',
  TENANTS_UPDATE: 'tenants:update',
  TENANTS_DELETE: 'tenants:delete',
  ORGANIZATIONS_READ: 'organizations:read',
  ORGANIZATIONS_UPDATE: 'organizations:update',
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  ROLES_READ: 'roles:read',
  ROLES_ASSIGN: 'roles:assign',
  PERMISSIONS_READ: 'permissions:read',
  AUDIT_READ: 'audit:read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SYSTEM_ROLES = {
  PLATFORM_OWNER: 'platform_owner',
  PLATFORM_ADMIN: 'platform_admin',
  TENANT_OWNER: 'tenant_owner',
  TENANT_ADMIN: 'tenant_admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  AGENT: 'agent',
  SALES: 'sales',
  SUPPORT: 'support',
  READ_ONLY: 'read_only',
} as const;
