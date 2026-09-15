import { createHash, randomBytes } from 'node:crypto';

/** Generates an opaque, high-entropy token (refresh/reset/verify tokens). */
export function generateOpaqueToken(): string {
  return randomBytes(48).toString('hex');
}

/** Refresh/reset/verification tokens are stored hashed, never in plaintext. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Turns "Acme Inc." into "acme-inc", suffixed with a short random id on collision. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}
