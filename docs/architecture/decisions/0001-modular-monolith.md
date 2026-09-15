# ADR-0001: Start with a Modular Monolith

## Status
Accepted

## Context
The product spec covers CRM, contact center, telephony, AI, analytics,
billing, and white-labeling. It would be easy to justify a dozen
microservices (auth, tenants, telephony, AI, billing, ...) from day one.
Principle #19/#20 in the engineering brief explicitly warn against
premature microservices and ask for a modular monolith that can later be
decomposed.

## Decision
Build a single NestJS application (`apps/api`) organized into isolated
feature modules with clear boundaries (own Prisma models, own services,
exported public interfaces). Modules do not reach into each other's
database tables directly. Cross-module communication happens through
injected services (in-process) now, which can be swapped for network
calls (HTTP/queue) later without changing calling code's shape.

## Consequences
- Faster iteration and simpler operations (one deploy, one database
  connection pool, one log stream) during the foundation and early CRM
  milestones.
- Decomposition path exists: because modules already don't share tables
  directly, extracting e.g. a `telephony` service later is a matter of
  moving a module and replacing its in-process interface with a network
  client, not a rewrite.
- Risk: discipline is required to not let modules reach into each other's
  Prisma models. Enforced by code review and directory-level ownership
  (each module's `*.service.ts` is the only place its tables are
  queried).
