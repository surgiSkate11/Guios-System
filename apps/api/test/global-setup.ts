import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { TEST_DATABASE_NAME, testDatabaseUrl } from './test-database';

/** Creates the test database if needed and applies every migration to it. */
export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DATABASE_NAME],
    );
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
