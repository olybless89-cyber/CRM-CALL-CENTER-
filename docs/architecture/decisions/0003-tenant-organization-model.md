# ADR-0003: Separate `Tenant` and `Organization`

## Status
Accepted

## Context
The database foundation requirement lists both `Tenant` and
`Organization` as distinct entities. Many SaaS systems conflate the two.
This product's spec explicitly calls for white-label capability, which
implies a workspace's public-facing identity (name, logo, domain) is a
distinct concern from the billing/isolation boundary.

## Decision
- `Tenant` is the isolation and billing boundary: one row per paying
  customer account. All tenant-owned tables carry `tenantId` pointing
  here. Plan/status/lifecycle fields live on `Tenant`.
- `Organization` is a 1:1 child of `Tenant` in this milestone, holding the
  customer-facing workspace profile: display name, slug/domain, branding
  fields reserved for white-label use later. Modeled as its own table
  (not columns on `Tenant`) so it can become 1:many under a tenant later
  (e.g. an agency reselling under multiple branded workspaces) without a
  breaking migration.

## Consequences
- One extra join for anything that needs display/branding info, in
  exchange for not conflating "who owns/pays for this data" with "how it
  presents itself" — the latter is exactly what white-labeling needs to
  vary independently.
- No CRM-specific "Account/Company" entity is implied by this decision;
  that is a future CRM-module concern and out of scope for this
  milestone.
