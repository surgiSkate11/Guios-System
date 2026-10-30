import { hashPassword } from '../auth/password';
import type { PrismaClient } from '../generated/prisma/client';

const ADMIN_NAME = 'Administrador';

function requireVariable(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required to create the default administrator (see README)`,
    );
  }
  return value;
}

/**
 * Creates the default administrator required by RF-01 when it does not exist yet.
 * Idempotent: an existing account with that email is left untouched (its password
 * is never overwritten).
 */
export async function seedAdmin(
  prisma: PrismaClient,
  env: Record<string, string | undefined>,
): Promise<void> {
  const email = requireVariable(env, 'ADMIN_EMAIL').toLowerCase();
  const password = requireVariable(env, 'ADMIN_PASSWORD');

  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) return;

  await prisma.usuario.create({
    data: {
      nombre: ADMIN_NAME,
      email,
      passwordHash: await hashPassword(password),
      rol: 'administrador',
    },
  });
}
