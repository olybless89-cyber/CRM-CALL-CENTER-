# Architecture Overview

## Product

Digital Weboracle CRM + Cloud Contact Center is a multi-tenant SaaS platform
combining CRM/Customer 360, sales pipeline, support, and a cloud contact
center (SIP/Asterisk/PJSIP/ARI/WebRTC, IVR, queues, recording, omnichannel,
AI, analytics, billing, white-label).

This document describes the architecture of the **foundation milestone**
only: the modular monolith, multi-tenancy, auth, and RBAC groundwork that
every later module builds on. It intentionally does not describe CRM,
telephony, or AI features — those are future milestones (see
`/docs/development/ROADMAP.md`).

## Repository Layout

```
/
├── apps/
│   ├── web/                # Next.js (App Router) frontend
│   └── api/                # NestJS backend (REST + WebSockets)
├── docs/
│   ├── architecture/       # This document + ADRs
│   └── development/        # Roadmap, contributing guide
├── docker-compose.yml       # Local dev environment
└── package.json              # npm workspaces root
```

Chosen over a multi-repo or premature microservices split — see
[ADR-0001](decisions/0001-modular-monolith.md).

## Style: Modular Monolith

The API (`apps/api`) is a single deployable NestJS application internally
divided into feature modules with explicit boundaries:

- `common/` — cross-cutting concerns: guards, interceptors, filters,
  decorators, DTO base classes.
- `config/` — environment loading and validation.
- `prisma/` — the single Prisma client / database access module. No other
  module talks to the database except through services in modules that own
  their entities.
- `auth/` — registration, login, logout, refresh tokens, password reset and
  email verification foundations.
- `tenants/` — tenant + organization lifecycle and tenant-context
  resolution.
- `users/` — user accounts, scoped to a tenant.
- `rbac/` — roles, permissions, role assignment, permission enforcement.
- `audit/` — audit log writes and queries.
- `health/` — liveness/readiness checks for Postgres and Redis.
- `redis/` — a single Redis connection used for caching, rate limiting, and
  (later) BullMQ queues and pub/sub.

Modules depend on each other only through their exported services, never
through direct Prisma queries into another module's tables. This is what
makes future decomposition into services possible without a rewrite — see
[ADR-0001](decisions/0001-modular-monolith.md).

## Multi-Tenancy

Tenant isolation is the single most important non-functional requirement
in this system. The approach:

- **Shared database, shared schema, row-level isolation.** Every
  tenant-owned table carries a `tenantId` column (see
  [ADR-0002](decisions/0002-multi-tenancy-strategy.md)).
- **Tenant context is derived from the authenticated JWT, never from
  client input.** A `TenantContextGuard` resolves the tenant from the
  verified access token and attaches it to the request. Controllers and
  services never accept a `tenantId` from the request body/query for
  scoping reads or writes.
- **Service-layer enforcement.** Every repository/service method that
  reads or writes tenant-owned data takes the resolved tenant id from
  request context and includes it in the `WHERE` clause. This is enforced
  by convention plus integration tests that prove cross-tenant access is
  impossible (see `apps/api/test/tenant-isolation.e2e-spec.ts`).
- **Tenant vs Organization.** `Tenant` is the billing/isolation boundary
  (one paying SaaS customer). `Organization` is the customer's workspace
  profile under a tenant (name, branding, domain) — see
  [ADR-0003](decisions/0003-tenant-organization-model.md). This keeps the
  door open for white-labeling / reseller scenarios without conflating
  "who owns the data" with "how the workspace presents itself."

## AuthN / AuthZ

- **Authentication**: email + password (argon2 hashing), short-lived JWT
  access tokens, rotating opaque refresh tokens stored hashed in Postgres.
  See [ADR-0004](decisions/0004-authentication-strategy.md).
- **Authorization**: RBAC with tenant-scoped role assignments and a
  granular permission system (`resource:action` keys). A
  `PermissionsGuard` + `@RequirePermissions()` decorator enforce access at
  the endpoint level. See [ADR-0005](decisions/0005-rbac-model.md).
- **Audit logging**: administrative and security-sensitive operations
  write an `AuditLog` row (actor, tenant, action, entity, metadata, IP).

## Telephony & AI Boundaries (not implemented this milestone)

No telephony or AI code exists yet. The architectural commitment made now,
so later work doesn't require a rewrite:

- All call-control logic will sit behind a `TelephonyProvider` interface
  (`packages` or `apps/api/src/telephony/adapters` once built). CRM/business
  logic will never call Asterisk/ARI/PJSIP directly.
- All AI features will sit behind an `AiProvider` interface. No CRM or
  contact-center logic will hard-code a specific AI vendor SDK.

See [ADR-0006](decisions/0006-telephony-ai-adapter-boundaries.md).

## Data Storage

- **PostgreSQL** is the system of record for all structured data.
- **Redis** is a cache / rate-limiter / pub-sub / future job queue backend
  only — never the source of truth for tenant data.
- **Object storage (S3-compatible)** is reserved for large media (call
  recordings, attachments) once telephony/CRM modules need it. Not
  implemented this milestone.

## API Conventions

- All routes are versioned under `/api/v1`.
- Responses follow a consistent envelope (`success`, `data`, `meta` /
  `error`) — see `apps/api/src/common/interceptors/response.interceptor.ts`
  and `apps/api/src/common/filters/http-exception.filter.ts`.
- Input validation via `class-validator` DTOs on every endpoint.
- OpenAPI docs are generated from the same DTOs/decorators and served at
  `/api/docs`.

## Observability Foundation

- Structured JSON logging (`nestjs-pino`), request-id correlation.
- `/api/v1/health` liveness/readiness endpoint checking Postgres and Redis
  connectivity.

## What This Milestone Deliberately Excludes

Per the engineering brief, this milestone stops at the foundation. Not
built yet: CRM entities (contacts, deals, pipelines), contact center
(queues, IVR, ARI integration), AI features, billing, white-label theming,
BullMQ job processors, WebSocket gateways, S3 integration. These are
tracked in `/docs/development/ROADMAP.md`.
