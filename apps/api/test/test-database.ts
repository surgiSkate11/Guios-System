import { config } from 'dotenv';
import { join } from 'node:path';

/** Name of the isolated database used by the e2e tests. */
export const TEST_DATABASE_NAME = 'guios_test';

/**
 * Derives the test database URL from DATABASE_URL in apps/api/.env by swapping
 * only the database name, so tests never touch the development database.
 */
export function testDatabaseUrl(): string {
  config({ path: join(__dirname, '..', '.env'), quiet: true });
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'DATABASE_URL is not set; create apps/api/.env (see README)',
    );
  }
  const url = new URL(base);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}
