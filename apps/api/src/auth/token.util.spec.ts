import { generateOpaqueToken, hashToken, slugify } from './token.util';

describe('token.util', () => {
  describe('generateOpaqueToken', () => {
    it('generates a long, high-entropy hex token', () => {
      const token = generateOpaqueToken();
      expect(token).toMatch(/^[a-f0-9]+$/);
      expect(token.length).toBeGreaterThanOrEqual(64);
    });

    it('never generates the same token twice', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateOpaqueToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe('hashToken', () => {
    it('is deterministic', () => {
      expect(hashToken('abc')).toEqual(hashToken('abc'));
    });

    it('never stores the plaintext token in the hash', () => {
      const token = 'super-secret-refresh-token';
      expect(hashToken(token)).not.toContain(token);
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('a')).not.toEqual(hashToken('b'));
    });
  });

  describe('slugify', () => {
    it('lowercases and hyphenates', () => {
      expect(slugify('Acme Inc.')).toBe('acme-inc');
    });

    it('strips leading/trailing hyphens produced by punctuation', () => {
      expect(slugify('--Weird!! Name--')).toBe('weird-name');
    });

    it('collapses repeated separators', () => {
      expect(slugify('a   b---c')).toBe('a-b-c');
    });
  });
});
