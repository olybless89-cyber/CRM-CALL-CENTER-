import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password to a non-plaintext argon2id digest', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).not.toEqual('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash for the same password each time (unique salt)', async () => {
    const [a, b] = await Promise.all([
      service.hash('same-password'),
      service.hash('same-password'),
    ]);
    expect(a).not.toEqual(b);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await service.hash('S3cure-Passw0rd!');
    await expect(service.verify(hash, 'S3cure-Passw0rd!')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('S3cure-Passw0rd!');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('does not throw on a malformed stored hash, just returns false', async () => {
    await expect(service.verify('not-a-real-hash', 'anything')).resolves.toBe(false);
  });
});
