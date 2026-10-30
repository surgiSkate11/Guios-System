import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Global prefix shared by every REST route. */
export const API_PREFIX = 'api';

/**
 * Applies the global HTTP configuration. Used by main.ts and by the e2e tests
 * so both run the application exactly the same way.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  // Unknown body fields are rejected (e.g. a self-chosen "rol" on sign-up).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
