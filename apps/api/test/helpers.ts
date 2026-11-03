import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import type { Rol } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

/** Full application wired like main.ts, plus shortcuts to seed data and sign requests. */
export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  reset: () => Promise<void>;
  /** Creates an active user and returns it with a valid Bearer header. */
  usuario: (
    rol: Rol,
    extra?: { email?: string; nombre?: string; idOrganizacion?: number | null },
  ) => Promise<{ id: number; auth: { Authorization: string } }>;
}

/** `configurar` can override providers, e.g. to fake external services. */
export async function createTestContext(
  configurar: (b: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestContext> {
  const moduleRef = await configurar(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  let counter = 0;

  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()),
    reset: () => resetDatabase(prisma),
    usuario: async (rol, extra = {}) => {
      counter += 1;
      const usuario = await prisma.usuario.create({
        data: {
          nombre: extra.nombre ?? `Usuario ${counter}`,
          email: extra.email ?? `u${counter}@test.local`,
          // Not a valid hash: tests sign tokens directly instead of logging in.
          passwordHash: 'x',
          rol,
          idOrganizacion: extra.idOrganizacion ?? null,
        },
      });
      const token = await jwt.signAsync({ sub: usuario.id });
      return { id: usuario.id, auth: { Authorization: `Bearer ${token}` } };
    },
  };
}
