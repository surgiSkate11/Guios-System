import { hash, verify } from '@node-rs/argon2';

/** Hashes a password with argon2id (library defaults: random salt, OWASP-level cost). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Checks a password against a stored hash; a malformed hash counts as a mismatch. */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
