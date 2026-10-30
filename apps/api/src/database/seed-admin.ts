import { hashPassword } from '../auth/password';
import type { PrismaClient } from '../generated/prisma/client';

const ADMIN_NAME = 'Administrador';
/** Same minimum as self sign-up (RegistroDto). */
const MIN_PASSWORD_LENGTH = 8;

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
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  }

  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    // An account self-registered with this email must not silently block the admin.
    if (existing.rol !== 'administrador') {
      throw new Error(
        'ADMIN_EMAIL already belongs to a non-administrator account; use another email',
      );
    }
    return;
  }

  await prisma.usuario.create({
    data: {
      nombre: ADMIN_NAME,
      email,
      passwordHash: await hashPassword(password),
      rol: 'administrador',
    },
  });
}
