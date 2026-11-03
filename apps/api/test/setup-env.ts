import { testDatabaseUrl } from './test-database';

// Runs before each e2e test file: point every Prisma client at the test database.
// @nestjs/config does not override variables that are already set.
process.env.DATABASE_URL = testDatabaseUrl();

// Rate limits are high in tests; the throttling test lowers it explicitly.
process.env.AUTH_RATE_LIMIT ??= '1000';
