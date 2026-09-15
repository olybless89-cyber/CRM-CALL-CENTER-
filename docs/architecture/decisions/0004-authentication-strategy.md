# ADR-0004: JWT Access Tokens + Rotating Hashed Refresh Tokens

## Status
Accepted

## Context
The brief requires registration, login, logout, refresh, secure password
hashing, and foundations for password reset and email verification,
without storing plaintext passwords or exposing secrets.

## Decision
- Passwords hashed with **argon2id** (via `argon2`), not a reversible
  scheme, not bcrypt (argon2id is the current OWASP recommendation and
  has no 72-byte input truncation footgun).
- **Access tokens**: short-lived (15 min) signed JWTs (HS256 in dev via
  `JWT_ACCESS_SECRET`; pluggable to RS256/JWKS later) carrying `sub`
  (user id), `tenantId`, and a `tokenVersion`-free claim set kept
  minimal — permissions are resolved server-side per request, not
  embedded in the token, so a permission change takes effect
  immediately rather than waiting for token expiry.
- **Refresh tokens**: opaque random strings, stored **hashed** (SHA-256)
  in the `RefreshToken` table with an expiry and revocation timestamp.
  Refresh rotates the token (old one is revoked, a new one issued) and
  detects reuse of a revoked token as a signal to revoke the whole
  family (foundation for this is the `revokedAt`/`replacedByTokenId`
  columns; full reuse-detection alerting is a future hardening item).
- **Password reset** and **email verification** foundations: single-use,
  hashed, time-limited tokens (`PasswordResetToken`,
  `EmailVerificationToken`) with endpoints to request/consume them.
  Actual email delivery is out of scope this milestone — tokens are
  returned only in non-production responses/logs for now, gated behind
  `NODE_ENV !== 'production'`, so the flow is provable without an email
  provider integration.
- Logout revokes the presented refresh token (and, optionally, all
  tokens for the session) — access tokens are not individually
  revocable given their short lifetime.

## Consequences
- No secrets or password hashes ever leave the API in responses.
- Refresh token theft is limited by rotation + short access-token
  lifetime; full reuse-detection alerting/notification is future work.
- Real email delivery (SMTP/provider) is a follow-up milestone; the
  token lifecycle and storage are already correct so wiring an email
  provider later is additive, not a redesign.
