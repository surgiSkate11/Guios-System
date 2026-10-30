import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('never returns the plaintext and uses argon2id', async () => {
    const hash = await hashPassword('s3cret-Pass');
    expect(hash).not.toContain('s3cret-Pass');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each time (random salt)', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret-Pass');
    await expect(verifyPassword(hash, 's3cret-Pass')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong')).resolves.toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    await expect(verifyPassword('not-a-hash', 'x')).resolves.toBe(false);
  });
});
