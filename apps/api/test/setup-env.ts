import { testDatabaseUrl } from './test-database';

// Runs before each e2e test file: point every Prisma client at the test database.
// @nestjs/config does not override variables that are already set.
process.env.DATABASE_URL = testDatabaseUrl();
