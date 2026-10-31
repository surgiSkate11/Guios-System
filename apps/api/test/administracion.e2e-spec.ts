import { createTestContext, TestContext } from './helpers';

describe('Administration A1 (e2e, test database)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(async () => {
    await t.reset();
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  describe('organizaciones', () => {
    it('lets an administrator create, list and update organizations', async () => {
      const admin = await t.usuario('administrador');
      const created = await t
        .http()
        .post('/api/organizaciones')
        .set(admin.auth)
        .send({ nombre: 'NovaTech', sector: 'privado' })
        .expect(201);
      expect(created.body).toEqual({
        id: expect.any(Number),
        nombre: 'NovaTech',
        sector: 'privado',
        activo: true,
      });

      await t
        .http()
        .patch(`/api/organizaciones/${created.body.id}`)
        .set(admin.auth)
        .send({ activo: false })
        .expect(200);

      const list = await t
        .http()
        .get('/api/organizaciones')
        .set(admin.auth)
        .expect(200);
      expect(list.body).toEqual([
        {
          id: created.body.id,
          nombre: 'NovaTech',
          sector: 'privado',
          activo: false,
        },
      ]);
    });

    it('rejects an unknown sector with 400 and creates nothing', async () => {
      const admin = await t.usuario('administrador');
      await t
        .http()
        .post('/api/organizaciones')
        .set(admin.auth)
        .send({ nombre: 'X', sector: 'otro' })
        .expect(400);
      expect(await t.prisma.organizacion.count()).toBe(0);
    });

    it.each(['invitado', 'coordinador'] as const)(
      'forbids a %s with 403',
      async (rol) => {
        const user = await t.usuario(rol);
        await t.http().get('/api/organizaciones').set(user.auth).expect(403);
        await t
          .http()
          .post('/api/organizaciones')
          .set(user.auth)
          .send({ nombre: 'X', sector: 'privado' })
          .expect(403);
      },
    );

    it('answers 404 for an unknown organization', async () => {
      const admin = await t.usuario('administrador');
      await t
        .http()
        .patch('/api/organizaciones/9999')
        .set(admin.auth)
        .send({ activo: false })
        .expect(404);
    });
  });

  describe('usuarios', () => {
    it('lists users with role, state and organization', async () => {
      const org = await t.prisma.organizacion.create({
        data: { nombre: 'NovaTech', sector: 'privado' },
      });
      const admin = await t.usuario('administrador', { email: 'a@t.local' });
      const coord = await t.usuario('coordinador', {
        email: 'c@t.local',
        idOrganizacion: org.id,
      });
      const res = await t
        .http()
        .get('/api/usuarios')
        .set(admin.auth)
        .expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({
          id: admin.id,
          rol: 'administrador',
          activo: true,
          organizacion: null,
        }),
        expect.objectContaining({
          id: coord.id,
          rol: 'coordinador',
          idOrganizacion: org.id,
          organizacion: { id: org.id, nombre: 'NovaTech' },
        }),
      ]);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('promotes an invitado to coordinador with an organization', async () => {
      const org = await t.prisma.organizacion.create({
        data: { nombre: 'NovaTech', sector: 'privado' },
      });
      const admin = await t.usuario('administrador');
      const user = await t.usuario('invitado');
      const res = await t
        .http()
        .patch(`/api/usuarios/${user.id}`)
        .set(admin.auth)
        .send({ rol: 'coordinador', idOrganizacion: org.id })
        .expect(200);
      expect(res.body).toMatchObject({
        rol: 'coordinador',
        idOrganizacion: org.id,
      });
    });

    it('refuses a coordinador without organization and leaves the user unchanged', async () => {
      const admin = await t.usuario('administrador');
      const user = await t.usuario('invitado');
      const res = await t
        .http()
        .patch(`/api/usuarios/${user.id}`)
        .set(admin.auth)
        .send({ rol: 'coordinador' })
        .expect(409);
      expect(res.body.message).toBe('Un coordinador necesita una organización');
      const stored = await t.prisma.usuario.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.rol).toBe('invitado');
    });

    it('refuses an inactive organization', async () => {
      const org = await t.prisma.organizacion.create({
        data: { nombre: 'Baja', sector: 'publico', activo: false },
      });
      const admin = await t.usuario('administrador');
      const user = await t.usuario('invitado');
      await t
        .http()
        .patch(`/api/usuarios/${user.id}`)
        .set(admin.auth)
        .send({ idOrganizacion: org.id })
        .expect(409);
    });

    it.each([{ rol: 'invitado' }, { activo: false }])(
      'forbids an administrator from changing their own account: %j',
      async (body) => {
        const admin = await t.usuario('administrador');
        const res = await t
          .http()
          .patch(`/api/usuarios/${admin.id}`)
          .set(admin.auth)
          .send(body)
          .expect(409);
        expect(res.body.message).toBe(
          'No puedes modificar tu propia cuenta de administrador',
        );
      },
    );

    it('deactivating a user ends their session immediately', async () => {
      const admin = await t.usuario('administrador');
      const user = await t.usuario('invitado');
      await t
        .http()
        .patch(`/api/usuarios/${user.id}`)
        .set(admin.auth)
        .send({ activo: false })
        .expect(200);
      await t.http().get('/api/auth/me').set(user.auth).expect(401);
    });

    it('forbids a coordinador from changing roles', async () => {
      const coord = await t.usuario('coordinador');
      const user = await t.usuario('invitado');
      await t
        .http()
        .patch(`/api/usuarios/${user.id}`)
        .set(coord.auth)
        .send({ rol: 'coordinador' })
        .expect(403);
    });
  });

  describe('parametros', () => {
    const DEFAULTS = {
      umbralFoda: 3,
      umbralDesacuerdo: 10,
      umbralEmpateTecnico: 2,
      umbralMetricaAlta: 80,
      umbralFactorDiscutido: 2,
      umbralDatosInciertos: 25,
      metodoConsolidacion: 'mediana',
    };

    it('returns the default thresholds to any signed-in user', async () => {
      const user = await t.usuario('invitado');
      const res = await t
        .http()
        .get('/api/parametros')
        .set(user.auth)
        .expect(200);
      expect(res.body).toEqual(DEFAULTS);
    });

    it('lets an administrator replace them', async () => {
      const admin = await t.usuario('administrador');
      const next = {
        ...DEFAULTS,
        umbralFoda: 2.5,
        metodoConsolidacion: 'promedio',
      };
      await t
        .http()
        .put('/api/parametros')
        .set(admin.auth)
        .send(next)
        .expect(200);
      const res = await t
        .http()
        .get('/api/parametros')
        .set(admin.auth)
        .expect(200);
      expect(res.body).toEqual(next);
    });

    it.each([
      { umbralFoda: 5 },
      { umbralFactorDiscutido: 4 },
      { umbralDatosInciertos: 101 },
      { metodoConsolidacion: 'moda' },
    ])('rejects out-of-range values with 400: %j', async (bad) => {
      const admin = await t.usuario('administrador');
      await t
        .http()
        .put('/api/parametros')
        .set(admin.auth)
        .send({ ...DEFAULTS, ...bad })
        .expect(400);
      const res = await t
        .http()
        .get('/api/parametros')
        .set(admin.auth)
        .expect(200);
      expect(res.body).toEqual(DEFAULTS);
    });

    it('forbids a coordinador from changing them', async () => {
      const coord = await t.usuario('coordinador');
      await t
        .http()
        .put('/api/parametros')
        .set(coord.auth)
        .send(DEFAULTS)
        .expect(403);
    });
  });
});
