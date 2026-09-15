# ADR-0002: Shared Database, Row-Level Multi-Tenancy

## Status
Accepted

## Context
Three common multi-tenancy strategies exist: separate database per tenant,
separate schema per tenant, or a shared schema with a `tenantId` column on
every tenant-owned table. The brief mandates tenant_id on every
tenant-owned entity (principle #3) and mandates tenant context be derived
from the authenticated session, never client input (Tenant Security
section).

## Decision
Use a single shared Postgres database and schema. Every tenant-owned
table has a non-nullable `tenantId` (UUID, FK to `Tenant`). All
tenant-scoped Prisma queries are written through service methods that
require a `tenantId` argument sourced from the authenticated request
context (`TenantContextGuard` / `@CurrentTenant()`), never from the
request body or query string.

Enforcement layers:
1. **Guard**: `TenantContextGuard` resolves `tenantId` from the verified
   JWT and attaches it to `request.tenant`. Endpoints that operate on
   tenant data require this guard.
2. **Service layer**: every read/write in `users`, `rbac`, `audit`, etc.
   takes the resolved tenant id and includes it in the Prisma `where`
   clause. A DTO-supplied `tenantId` field is never bound to a query.
3. **Tests**: `apps/api/test/tenant-isolation.e2e-spec.ts` creates two
   tenants and asserts Tenant A's authenticated requests cannot read or
   mutate Tenant B's users/roles, and that a forged/mismatched tenant
   header has no effect.

## Consequences
- Simpler operations than database-per-tenant (one connection pool, one
  migration run, easy cross-tenant admin/analytics later).
- Isolation depends on disciplined application-level enforcement rather
  than a database-provided hard boundary. This is mitigated with the
  guard + service-layer convention and dedicated isolation tests, and can
  be hardened later with Postgres Row Level Security (RLS) policies as a
  defense-in-depth layer once the schema stabilizes — tracked as a future
  hardening item, not required for this milestone.
- Schema/database-per-tenant remains an option for a future "dedicated"
  tier if a customer requires physical isolation; the `tenantId` model
  does not preclude migrating specific large tenants later.
