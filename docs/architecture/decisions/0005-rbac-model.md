# ADR-0005: Tenant-Scoped RBAC with Granular Permissions

## Status
Accepted

## Context
The brief lists ten roles (Platform Owner, Platform Admin, Tenant Owner,
Tenant Admin, Manager, Supervisor, Agent, Sales, Support, Read Only) and
requires "granular permissions", centralized authZ, and auditable admin
actions.

## Decision
- `Permission` rows are fine-grained `resource:action` keys (e.g.
  `users:create`, `roles:assign`, `audit:read`). They are global/system
  defined, not per-tenant.
- `Role` rows can be **system roles** (`isSystem = true`, `tenantId =
  null`, seeded once — the ten roles from the brief) or, in future,
  tenant-custom roles (`tenantId` set) — the column already supports
  this so custom roles are additive later, not a schema change.
- `RolePermission` is the many-to-many between roles and permissions.
- `UserRole` assigns a role to a user **within a tenant**
  (`userId`, `roleId`, `tenantId`), so the same user could in principle
  hold different roles in different tenants (e.g. a platform admin who
  is also a tenant owner of their own sandbox tenant).
- Enforcement: `PermissionsGuard` reads `@RequirePermissions('x:y')` off
  the route handler, loads the current user's effective permissions for
  the resolved tenant (role → permission join, cached briefly in Redis),
  and rejects with 403 if any required permission is missing. Two
  platform-level roles (`platform_owner`, `platform_admin`) bypass
  tenant scoping for cross-tenant administrative operations only.
- Every mutation through an admin-facing endpoint (role assignment, user
  creation/deactivation, permission changes) writes an `AuditLog` row via
  an interceptor, per principle #14.

## Consequences
- Adding a new permission is a data change (seed), not a code change to
  every guard.
- Role→permission caching in Redis means a permission edit can take up
  to the cache TTL (kept short, e.g. 30s) to propagate; acceptable
  trade-off for this milestone, documented so it isn't mistaken for a
  bug later.
