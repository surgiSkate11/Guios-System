import { PrismaPg } from '@prisma/adapter-pg';
import { verifyPassword } from '../src/auth/password';
import { seedAdmin } from '../src/database/seed-admin';
import { resetDatabase } from './reset-database';
import { PrismaClient } from '../src/generated/prisma/client';

describe('seedAdmin (e2e, test database)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  const env = {
    ADMIN_EMAIL: 'Admin@Guios.Local',
    ADMIN_PASSWORD: 'Adm1n-pass',
  };

  it('creates exactly one administrator even when run twice', async () => {
    await seedAdmin(prisma, env);
    await seedAdmin(prisma, env);

    const admins = await prisma.usuario.findMany({
      where: { rol: 'administrador' },
    });
    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe('admin@guios.local');
    expect(admins[0].activo).toBe(true);
    await expect(
      verifyPassword(admins[0].passwordHash, 'Adm1n-pass'),
    ).resolves.toBe(true);
  });

  it('does not overwrite the password of an existing administrator', async () => {
    await seedAdmin(prisma, env);
    await seedAdmin(prisma, { ...env, ADMIN_PASSWORD: 'another-pass' });

    const admin = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'admin@guios.local' },
    });
    await expect(
      verifyPassword(admin.passwordHash, 'Adm1n-pass'),
    ).resolves.toBe(true);
  });

  it.each(['ADMIN_EMAIL', 'ADMIN_PASSWORD'] as const)(
    'rejects when %s is missing and creates no user',
    async (missing) => {
      const partial: Record<string, string | undefined> = {
        ...env,
        [missing]: undefined,
      };
      await expect(seedAdmin(prisma, partial)).rejects.toThrow(missing);
      expect(await prisma.usuario.count()).toBe(0);
    },
  );
});
