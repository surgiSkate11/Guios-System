import type { PrismaClient } from '../src/generated/prisma/client';

/**
 * Empties every application table of the test database. Only ever called with the
 * test DATABASE_URL set by setup-env.ts.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  if (!process.env.DATABASE_URL?.includes('/guios_test')) {
    throw new Error(
      'resetDatabase refuses to run outside the guios_test database',
    );
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}
