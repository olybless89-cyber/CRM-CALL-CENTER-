# ADR-0006: Telephony and AI Behind Provider-Agnostic Adapters

## Status
Accepted (interface commitment only — no implementation this milestone)

## Context
Principles #6–#9 forbid hard-coding a SIP carrier or AI provider and
forbid tight coupling between CRM logic and Asterisk. No telephony or AI
code is being written in this milestone, but decisions made now (schema,
module boundaries) must not foreclose this.

## Decision
- Telephony will be implemented behind a `TelephonyProvider` interface
  (e.g. `initiateCall`, `hangupCall`, `transferCall`, event callbacks for
  call state) with Asterisk/ARI as the first concrete adapter. No
  business/CRM module will import an Asterisk/ARI/PJSIP client directly;
  they will depend on the interface, injected via NestJS DI, so a second
  provider (or a mock, for tests) can be substituted without touching
  CRM code.
- AI features (routing, summarization, sentiment, etc.) will sit behind
  an `AiProvider` interface with the concrete vendor SDK as an adapter,
  for the same reason.
- Neither interface nor adapter is implemented in this milestone. The
  only artifact of this ADR right now is the constraint itself and the
  module boundary (`apps/api/src/telephony/`, `apps/api/src/ai/` are
  reserved names for when that work starts) plus S3-compatible storage
  (not Postgres) as the designated home for recordings/media, per
  principle #12.

## Consequences
- No code impact today. Prevents a future "quick" direct Asterisk call
  from inside a CRM controller, which would be expensive to unwind.
