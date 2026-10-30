import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedAdmin } from '../src/database/seed-admin';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await seedAdmin(prisma, process.env);
    console.log('Seed completed: default administrator is present.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
