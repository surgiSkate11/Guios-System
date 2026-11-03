import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/auth/password';
import { MailService } from '../src/mail/mail.service';
import { createTestContext, TestContext } from './helpers';

describe('Password recovery and security hardening (e2e, test database)', () => {
  let t: TestContext;
  let mail: MailService;

  beforeAll(async () => {
    t = await createTestContext();
    mail = t.app.get(MailService);
  });
  beforeEach(async () => {
    await t.reset();
    mail.enviados.length = 0;
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  async function crear(email = 'ana@org.com', password = 'clave-vieja-1') {
    return t.prisma.usuario.create({
      data: {
        nombre: 'Ana',
        email,
        passwordHash: await hashPassword(password),
      },
    });
  }
  const tokenDelCorreo = () => {
    const texto = mail.enviados.at(-1)!.texto;
    return /token=([\w-]+)/.exec(texto)![1];
  };
  const login = (email: string, password: string) =>
    t.http().post('/api/auth/login').send({ email, password });

  it('sends a one-time link, stores only its hash and lets the user reset (RF-25)', async () => {
    const u = await crear();
    await t
      .http()
      .post('/api/auth/recuperar')
      .send({ email: 'ANA@org.com' })
      .expect(204);
    expect(mail.enviados).toHaveLength(1);
    expect(mail.enviados[0].para).toBe('ana@org.com');
    const token = tokenDelCorreo();
    const fila = await t.prisma.tokenRecuperacion.findFirstOrThrow({
      where: { idUsuario: u.id },
    });
    expect(fila.tokenHash).not.toContain(token);

    await t
      .http()
      .post('/api/auth/restablecer')
      .send({ token, password: 'clave-nueva-1' })
      .expect(204);
    await login('ana@org.com', 'clave-nueva-1').expect(200);
    await login('ana@org.com', 'clave-vieja-1').expect(401);
    const usado = await t
      .http()
      .post('/api/auth/restablecer')
      .send({ token, password: 'otra-clave-1' })
      .expect(400);
    expect(usado.body.message).toBe('El enlace no es válido o venció');
  });

  it('a reset invalidates every other pending link of the user', async () => {
    await crear();
    await t
      .http()
      .post('/api/auth/recuperar')
      .send({ email: 'ana@org.com' })
      .expect(204);
    const primero = tokenDelCorreo();
    await t
      .http()
      .post('/api/auth/recuperar')
      .send({ email: 'ana@org.com' })
      .expect(204);
    const segundo = tokenDelCorreo();
    await t
      .http()
      .post('/api/auth/restablecer')
      .send({ token: segundo, password: 'clave-nueva-1' })
      .expect(204);
    await t
      .http()
      .post('/api/auth/restablecer')
      .send({ token: primero, password: 'otra-clave-1' })
      .expect(400);
    await login('ana@org.com', 'clave-nueva-1').expect(200);
  });

  it('answers 204 for an unknown or inactive email without creating a token', async () => {
    await t.prisma.usuario.update({
      where: { id: (await crear('baja@org.com')).id },
      data: { activo: false },
    });
    await t
      .http()
      .post('/api/auth/recuperar')
      .send({ email: 'nadie@org.com' })
      .expect(204);
    await t
      .http()
      .post('/api/auth/recuperar')
      .send({ email: 'baja@org.com' })
      .expect(204);
    expect(await t.prisma.tokenRecuperacion.count()).toBe(0);
    expect(mail.enviados).toHaveLength(0);
  });

  it('rejects expired and unknown tokens and short passwords, leaving the password unchanged', async () => {
    await crear();
    await t
      .http()
      .post('/api/auth/recuperar')
      .send({ email: 'ana@org.com' })
      .expect(204);
    const token = tokenDelCorreo();
    await t
      .http()
      .post('/api/auth/restablecer')
      .send({ token, password: 'corta' })
      .expect(400);
    await t
      .http()
      .post('/api/auth/restablecer')
      .send({ token: 'no-existe', password: 'clave-nueva-1' })
      .expect(400);
    await t.prisma.tokenRecuperacion.updateMany({
      data: { venceEn: new Date(Date.now() - 1000) },
    });
    await t
      .http()
      .post('/api/auth/restablecer')
      .send({ token, password: 'clave-nueva-1' })
      .expect(400);
    await login('ana@org.com', 'clave-vieja-1').expect(200);
  });

  it('stores emails lowercased: the database rejects uppercase emails', async () => {
    await expect(
      t.prisma.usuario.create({
        data: { nombre: 'X', email: 'Mayus@Org.com', passwordHash: 'x' },
      }),
    ).rejects.toThrow();
  });

  it('refuses to start with a JWT_SECRET shorter than 32 characters', async () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'demasiado-corta';
    try {
      const moduleRef = Test.createTestingModule({ imports: [AppModule] });
      await expect(moduleRef.compile()).rejects.toThrow('JWT_SECRET');
    } finally {
      process.env.JWT_SECRET = original;
    }
  });

  it('answers 429 after too many login attempts', async () => {
    const original = process.env.AUTH_RATE_LIMIT;
    process.env.AUTH_RATE_LIMIT = '3';
    const limitado = await createTestContext();
    try {
      for (let i = 0; i < 3; i++) {
        await limitado
          .http()
          .post('/api/auth/login')
          .send({ email: 'x@y.com', password: 'x' })
          .expect(401);
      }
      const res = await limitado
        .http()
        .post('/api/auth/login')
        .send({ email: 'x@y.com', password: 'x' })
        .expect(429);
      expect(res.body.message).toBe('Demasiados intentos; espera un minuto');
    } finally {
      process.env.AUTH_RATE_LIMIT = original;
      await limitado.app.close();
    }
  });
});
