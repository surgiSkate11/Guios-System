import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

describe('Auth (e2e, test database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function crearUsuario(
    email: string,
    password: string,
    rol: 'invitado' | 'coordinador' | 'administrador' = 'invitado',
    activo = true,
  ) {
    return prisma.usuario.create({
      data: {
        nombre: 'Persona',
        email,
        passwordHash: await hashPassword(password),
        rol,
        activo,
      },
    });
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await http()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  describe('POST /api/auth/registro (RF-01, HU-18)', () => {
    it('creates an invitado account, returns a token and never the password', async () => {
      const res = await http()
        .post('/api/auth/registro')
        .send({
          nombre: 'Ana Pérez',
          email: 'Ana@Org.com',
          password: 'clave-segura',
        })
        .expect(201);

      expect(res.body).toEqual({
        accessToken: expect.any(String),
        usuario: {
          id: expect.any(Number),
          nombre: 'Ana Pérez',
          email: 'ana@org.com',
          rol: 'invitado',
          idOrganizacion: null,
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('clave-segura');
      const stored = await prisma.usuario.findUniqueOrThrow({
        where: { email: 'ana@org.com' },
      });
      expect(stored.passwordHash).not.toBe('clave-segura');
      await expect(
        verifyPassword(stored.passwordHash, 'clave-segura'),
      ).resolves.toBe(true);
    });

    it('rejects a self-chosen role with 400 and creates nobody', async () => {
      await http()
        .post('/api/auth/registro')
        .send({
          nombre: 'Eve',
          email: 'eve@org.com',
          password: 'clave-segura',
          rol: 'administrador',
        })
        .expect(400);
      expect(await prisma.usuario.count()).toBe(0);
    });

    it('rejects a duplicate email regardless of case with 409', async () => {
      await crearUsuario('ana@org.com', 'clave-segura');
      const res = await http()
        .post('/api/auth/registro')
        .send({ nombre: 'Ana', email: 'ANA@org.com', password: 'otra-clave-1' })
        .expect(409);
      expect(res.body.message).toBe('El correo ya está registrado');
      expect(await prisma.usuario.count()).toBe(1);
    });

    it.each([
      [{ nombre: 'Ana', email: 'no-es-correo', password: 'clave-segura' }],
      [{ nombre: 'Ana', email: 'ana@org.com', password: 'corta' }],
      [{ nombre: '', email: 'ana@org.com', password: 'clave-segura' }],
      [{ email: 'ana@org.com', password: 'clave-segura' }],
    ])(
      'rejects invalid input with 400 and creates nobody: %j',
      async (body) => {
        await http().post('/api/auth/registro').send(body).expect(400);
        expect(await prisma.usuario.count()).toBe(0);
      },
    );
  });

  describe('POST /api/auth/login', () => {
    it('returns a token and the public user for valid credentials', async () => {
      const usuario = await crearUsuario(
        'coord@org.com',
        'clave-segura',
        'coordinador',
      );
      const res = await http()
        .post('/api/auth/login')
        .send({ email: 'COORD@org.com', password: 'clave-segura' })
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.usuario).toEqual({
        id: usuario.id,
        nombre: 'Persona',
        email: 'coord@org.com',
        rol: 'coordinador',
        idOrganizacion: null,
      });
    });

    it.each([
      ['wrong password', 'coord@org.com', 'incorrecta'],
      ['unknown email', 'nadie@org.com', 'clave-segura'],
    ])(
      'answers 401 with the same message for %s',
      async (_case, email, password) => {
        await crearUsuario('coord@org.com', 'clave-segura');
        const res = await http()
          .post('/api/auth/login')
          .send({ email, password })
          .expect(401);
        expect(res.body.message).toBe('Credenciales inválidas');
        expect(res.body.accessToken).toBeUndefined();
      },
    );

    it('rejects an inactive account with 401', async () => {
      await crearUsuario('baja@org.com', 'clave-segura', 'invitado', false);
      const res = await http()
        .post('/api/auth/login')
        .send({ email: 'baja@org.com', password: 'clave-segura' })
        .expect(401);
      expect(res.body.message).toBe('Credenciales inválidas');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user for a valid token', async () => {
      await crearUsuario('ana@org.com', 'clave-segura');
      const token = await login('ana@org.com', 'clave-segura');
      const res = await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({ email: 'ana@org.com', rol: 'invitado' });
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('answers 401 without a token or with an invalid one', async () => {
      await http().get('/api/auth/me').expect(401);
      await http()
        .get('/api/auth/me')
        .set('Authorization', 'Bearer no-es-un-token')
        .expect(401);
    });

    it('answers 401 for a token signed with an algorithm other than HS256', async () => {
      const usuario = await crearUsuario('ana@org.com', 'clave-segura');
      const token = await app
        .get(JwtService)
        .signAsync({ sub: usuario.id }, { algorithm: 'HS512' });
      await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('answers 401 once the account is deactivated, even with a valid token', async () => {
      const usuario = await crearUsuario('ana@org.com', 'clave-segura');
      const token = await login('ana@org.com', 'clave-segura');
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { activo: false },
      });
      await http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('role guard (RNF-08, HU-18)', () => {
    it('forbids an invitado from an administrator route with 403', async () => {
      await crearUsuario('ana@org.com', 'clave-segura', 'invitado');
      const token = await login('ana@org.com', 'clave-segura');
      await http()
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('forbids a coordinador from an administrator route with 403', async () => {
      await crearUsuario('coord@org.com', 'clave-segura', 'coordinador');
      const token = await login('coord@org.com', 'clave-segura');
      await http()
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lets an administrator list users without password hashes', async () => {
      await crearUsuario('admin@org.com', 'clave-segura', 'administrador');
      await crearUsuario('ana@org.com', 'clave-segura');
      const token = await login('admin@org.com', 'clave-segura');
      const res = await http()
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(2);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('requires authentication on protected routes and keeps /api/health public', async () => {
      await http().get('/api/usuarios').expect(401);
      await http().get('/api/health').expect(200);
    });
  });
});
