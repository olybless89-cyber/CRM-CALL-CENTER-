# Contributing

## Prerequisites
- Node.js 20+ and npm 10+
- Docker + Docker Compose

## Getting Started
```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run prisma:migrate --workspace apps/api
npm run prisma:seed --workspace apps/api
npm run dev
```
`npm run dev` runs both `apps/web` and `apps/api` in watch mode via
workspaces. `docker compose up` runs the full stack (web, api, postgres,
redis) in containers for an environment that matches CI/production.

## Repository Conventions
- **Workspaces**: `apps/web` (Next.js), `apps/api` (NestJS). Shared code
  is not extracted into a `packages/` workspace until at least two apps
  need it — avoid speculative shared packages.
- **Commits**: imperative mood, small and scoped (`feat(api): add refresh
  token rotation`, `fix(web): ...`).
- **Branches**: `main` is always deployable. Feature branches off `main`.

## Architecture Rules (enforced in review)
1. A module's Prisma models are only queried from that module's own
   services. Cross-module access goes through the other module's
   exported service, not its Prisma delegate.
2. No controller/service trusts a `tenantId` from request body/query for
   scoping a query. Tenant id comes from `@CurrentTenant()` /
   `request.tenant`, resolved from the verified JWT.
3. No SIP/Asterisk client or AI vendor SDK is imported outside its
   adapter (see `docs/architecture/decisions/0006-*.md`). These modules
   do not exist yet — this rule applies once Milestones 3/5 start.
4. Any endpoint that performs an administrative or security-sensitive
   action (role change, user creation, permission change, tenant
   creation) must write an `AuditLog` entry.
5. Every new endpoint has a DTO with `class-validator` decorators — no
   untyped `any` request bodies.
6. New architectural decisions (new dependency category, new
   cross-cutting pattern, anything that would surprise someone reading
   `docs/architecture/README.md`) get an ADR in
   `docs/architecture/decisions/` before or alongside the code.

## Testing
- `npm run test --workspace apps/api` — unit tests.
- `npm run test:e2e --workspace apps/api` — integration tests (spins up
  against Postgres/Redis; run `docker compose up -d postgres redis`
  first, or point `DATABASE_URL`/`REDIS_URL` at running instances).
- New critical functionality (auth, tenant isolation, permission checks)
  requires a test in the same PR — see principle #16 in the architecture
  README.

## Code Quality
- Strict TypeScript, ESLint + Prettier (`npm run lint`, `npm run
  format`). CI fails on lint or type errors.
- Avoid `any`; if truly unavoidable, comment why.
- No secrets in code or committed `.env` files — see `.env.example` for
  the variables each app expects.
