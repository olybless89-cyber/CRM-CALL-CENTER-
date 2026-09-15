# Roadmap

Milestones are sequential. Each one ends with a stop-and-report; the next
does not start automatically.

## Milestone 0 — Engineering Foundation (this milestone)
Monorepo, Next.js + NestJS skeletons, Postgres + Prisma, Redis, Docker
Compose dev environment, tenant/user/RBAC/audit data model, auth
(register/login/logout/refresh, password reset + email verification
foundations), tenant isolation enforcement + tests, health checks,
OpenAPI, CI.

## Milestone 1 — CRM Core (Customer 360)
Contacts, Companies/Accounts, Deals/Pipeline, Notes/Activities, tagging,
custom fields foundation. Builds directly on tenant/RBAC/audit from
Milestone 0. No telephony dependency.

## Milestone 2 — Support / Ticketing
Tickets, SLAs, queues (non-voice), assignment rules, canned responses.
Shares the "queue" concept that the contact center will later reuse for
voice.

## Milestone 3 — Telephony Foundation
`TelephonyProvider` interface + Asterisk/ARI/PJSIP adapter, WebRTC
browser calling, inbound/outbound call handling, click-to-call from CRM.
S3-compatible storage wired for call recordings (never Postgres). This is
the first milestone where `apps/api/src/telephony` is implemented per
ADR-0006.

## Milestone 4 — Contact Center Operations
Call queues, IVR builder, agent presence/status, call recording
lifecycle, supervisor monitoring (listen/whisper/barge foundations),
omnichannel inbox (chat/email alongside voice).

## Milestone 5 — AI Layer
`AiProvider` interface + first adapter, call summarization, sentiment,
suggested replies, routing assistance. Provider-agnostic per ADR-0006.

## Milestone 6 — Analytics & Reporting
Cross-module dashboards (sales, support, contact center KPIs), scheduled
reports, exports.

## Milestone 7 — Billing & Plans
Subscription/usage billing per tenant, plan limits enforcement, invoicing
integration.

## Milestone 8 — White-Label & Self-Host Packaging
Organization branding surfaced end-to-end (custom domain, theme, logo),
packaged self-host deployment (building on the Docker Compose foundation
from Milestone 0), production Postgres RLS hardening pass (see
ADR-0002).

## Non-Goals For Now
Microservice decomposition (ADR-0001) is deferred until a concrete
scaling or team-ownership need justifies extracting a specific module —
not attempted speculatively.
