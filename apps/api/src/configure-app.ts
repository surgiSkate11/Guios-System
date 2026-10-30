import { INestApplication } from '@nestjs/common';

/** Global prefix shared by every REST route. */
export const API_PREFIX = 'api';

/**
 * Applies the global HTTP configuration. Used by main.ts and by the e2e tests
 * so both run the application exactly the same way.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}
