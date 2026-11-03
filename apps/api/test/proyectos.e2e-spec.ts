import { crearOrganizacion, seedCatalogo } from './fixtures';
import { createTestContext, TestContext } from './helpers';

describe('Projects and judges A3 (e2e, test database)', () => {
  let t: TestContext;
  let cat: Awaited<ReturnType<typeof seedCatalogo>>;
  let orgId: number;
  let coord: Awaited<ReturnType<TestContext['usuario']>>;

  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(async () => {
    await t.reset();
    cat = await seedCatalogo(t.prisma);
    orgId = (await crearOrganizacion(t.prisma)).id;
    coord = await t.usuario('coordinador', {
      idOrganizacion: orgId,
      nombre: 'Coord',
    });
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  const nuevo = () => ({
    nombre: 'Sistema de inventario',
    fechaInicio: '2026-10-01',
    metodoConsolidacion: 'mediana',
    idDimensiones: [cat.tec.id],
    softwares: [
      { nombre: 'Odoo', licencia: 'LGPL-3.0' },
      { nombre: 'Dolibarr' },
    ],
  });

  async function crearProyecto(body = nuevo()) {
    const res = await t
      .http()
      .post('/api/proyectos')
      .set(coord.auth)
      .send(body)
      .expect(201);
    return res.body as { id: number; softwares: { id: number }[] };
  }

  async function agregarJurado(idProyecto: number, idUsuario: number) {
    return t
      .http()
      .post(`/api/proyectos/${idProyecto}/jurados`)
      .set(coord.auth)
      .send({ idUsuario })
      .expect(201);
  }

  describe('create and read', () => {
    it('creates a draft in my organization with factors of the chosen dimensions', async () => {
      const res = await t
        .http()
        .post('/api/proyectos')
        .set(coord.auth)
        .send(nuevo())
        .expect(201);
      expect(res.body).toMatchObject({
        nombre: 'Sistema de inventario',
        estado: 'borrador',
        metodoConsolidacion: 'mediana',
        fechaInicio: '2026-10-01',
        fechaFin: null,
        versionCatalogo: 1,
        organizacion: { id: orgId, nombre: 'NovaTech' },
        coordinador: { id: coord.id, nombre: 'Coord' },
        dimensiones: [{ id: cat.tec.id, nombre: 'Tecnológica' }],
        jurados: [],
        miRol: 'coordinador',
        miEstadoJurado: null,
      });
      expect(res.body.softwares).toEqual([
        expect.objectContaining({
          nombre: 'Odoo',
          licencia: 'LGPL-3.0',
          version: null,
        }),
        expect.objectContaining({ nombre: 'Dolibarr', licencia: null }),
      ]);
      const factores = await t.prisma.proyectoFactor.findMany({
        where: { idProyecto: res.body.id },
        orderBy: { idFactor: 'asc' },
      });
      // Active factors of "Tecnológica" only, with the catalog IS and default scope.
      expect(
        factores.map((f) => [f.idFactor, f.impSugerida, f.alcanceEfectivo]),
      ).toEqual([
        [cat.usabilidad.id, 3, 'externo'],
        [cat.documentacion.id, 2, 'externo'],
      ]);
    });

    it.each([
      [{ softwares: [] }],
      [{ idDimensiones: [] }],
      [{ fechaInicio: '01/10/2026' }],
      [{ metodoConsolidacion: 'moda' }],
      [{ nombre: '' }],
    ])(
      'rejects invalid input with 400 and creates nothing: %j',
      async (bad) => {
        await t
          .http()
          .post('/api/proyectos')
          .set(coord.auth)
          .send({ ...nuevo(), ...bad })
          .expect(400);
        expect(await t.prisma.proyectoEvaluacion.count()).toBe(0);
      },
    );

    it('rejects an end date before the start date with 400', async () => {
      await t
        .http()
        .post('/api/proyectos')
        .set(coord.auth)
        .send({ ...nuevo(), fechaFin: '2026-09-01' })
        .expect(400);
    });

    it('rejects an unknown dimension with 400', async () => {
      await t
        .http()
        .post('/api/proyectos')
        .set(coord.auth)
        .send({ ...nuevo(), idDimensiones: [9999] })
        .expect(400);
      expect(await t.prisma.proyectoEvaluacion.count()).toBe(0);
    });

    it.each(['invitado', 'administrador'] as const)(
      'forbids a %s from creating projects',
      async (rol) => {
        const user = await t.usuario(rol);
        await t
          .http()
          .post('/api/proyectos')
          .set(user.auth)
          .send(nuevo())
          .expect(403);
      },
    );

    it('answers 409 when there is no catalog', async () => {
      await t.reset();
      const org = await crearOrganizacion(t.prisma);
      const c = await t.usuario('coordinador', { idOrganizacion: org.id });
      const res = await t
        .http()
        .post('/api/proyectos')
        .set(c.auth)
        .send(nuevo())
        .expect(409);
      expect(res.body.message).toBe('No hay un catálogo cargado');
    });

    it('hides projects from users without access (404) and lists only visible ones', async () => {
      const p = await crearProyecto();
      const otraOrg = await crearOrganizacion(t.prisma, 'Otra');
      const ajeno = await t.usuario('coordinador', {
        idOrganizacion: otraOrg.id,
      });
      const admin = await t.usuario('administrador');
      await t.http().get(`/api/proyectos/${p.id}`).set(ajeno.auth).expect(404);
      await t.http().get(`/api/proyectos/${p.id}`).set(admin.auth).expect(404);
      const lista = await t
        .http()
        .get('/api/proyectos')
        .set(ajeno.auth)
        .expect(200);
      expect(lista.body).toEqual([]);
      const mia = await t
        .http()
        .get('/api/proyectos')
        .set(coord.auth)
        .expect(200);
      expect(mia.body.map((x: { id: number }) => x.id)).toEqual([p.id]);
    });

    it('filters the list by estado', async () => {
      await crearProyecto();
      const res = await t
        .http()
        .get('/api/proyectos?estado=en_curso')
        .set(coord.auth)
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('softwares and project data', () => {
    it('adds and removes software while in draft', async () => {
      const p = await crearProyecto();
      const added = await t
        .http()
        .post(`/api/proyectos/${p.id}/softwares`)
        .set(coord.auth)
        .send({ nombre: 'ERPNext', version: '15' })
        .expect(201);
      expect(added.body.softwares).toHaveLength(3);
      const res = await t
        .http()
        .delete(`/api/proyectos/${p.id}/softwares/${p.softwares[0].id}`)
        .set(coord.auth)
        .expect(200);
      expect(
        res.body.softwares.map((s: { nombre: string }) => s.nombre),
      ).toEqual(['Dolibarr', 'ERPNext']);
    });

    it('updates name and method, and only the coordinator may do it', async () => {
      const p = await crearProyecto();
      const juez = await t.usuario('invitado');
      await agregarJurado(p.id, juez.id);
      await t
        .http()
        .patch(`/api/proyectos/${p.id}`)
        .set(juez.auth)
        .send({ nombre: 'Hack' })
        .expect(403);
      const res = await t
        .http()
        .patch(`/api/proyectos/${p.id}`)
        .set(coord.auth)
        .send({ nombre: 'Inventario 2', metodoConsolidacion: 'promedio' })
        .expect(200);
      expect(res.body).toMatchObject({
        nombre: 'Inventario 2',
        metodoConsolidacion: 'promedio',
      });
    });
  });

  describe('judges and requests', () => {
    it('invites a user, who sees the request and accepts it', async () => {
      const p = await crearProyecto();
      const juez = await t.usuario('invitado', {
        email: 'juez@x.com',
        nombre: 'Juez',
      });

      const found = await t
        .http()
        .get('/api/usuarios/buscar?email=JUEZ@x.com')
        .set(coord.auth)
        .expect(200);
      expect(found.body).toEqual({
        id: juez.id,
        nombre: 'Juez',
        email: 'juez@x.com',
      });

      const added = await agregarJurado(p.id, juez.id);
      expect(added.body.jurados).toEqual([
        {
          idUsuario: juez.id,
          nombre: 'Juez',
          email: 'juez@x.com',
          estado: 'invitado',
          idDimensiones: [cat.tec.id],
        },
      ]);

      const solicitudes = await t
        .http()
        .get('/api/solicitudes')
        .set(juez.auth)
        .expect(200);
      expect(solicitudes.body).toEqual([
        expect.objectContaining({
          id: p.id,
          miRol: 'jurado',
          miEstadoJurado: 'invitado',
        }),
      ]);

      const accepted = await t
        .http()
        .post(`/api/proyectos/${p.id}/solicitud/aceptar`)
        .set(juez.auth)
        .expect(200);
      expect(accepted.body.miEstadoJurado).toBe('activo');
      const vacias = await t
        .http()
        .get('/api/solicitudes')
        .set(juez.auth)
        .expect(200);
      expect(vacias.body).toEqual([]);
      const lista = await t
        .http()
        .get('/api/proyectos')
        .set(juez.auth)
        .expect(200);
      expect(lista.body).toHaveLength(1);
    });

    it('rejecting a request removes the judge', async () => {
      const p = await crearProyecto();
      const juez = await t.usuario('invitado');
      await agregarJurado(p.id, juez.id);
      await t
        .http()
        .post(`/api/proyectos/${p.id}/solicitud/rechazar`)
        .set(juez.auth)
        .expect(204);
      expect(await t.prisma.juradoProyecto.count()).toBe(0);
      await t.http().get(`/api/proyectos/${p.id}`).set(juez.auth).expect(404);
    });

    it('the coordinator added as judge is active at once (single-judge mode)', async () => {
      const p = await crearProyecto();
      const res = await agregarJurado(p.id, coord.id);
      expect(res.body.jurados[0].estado).toBe('activo');
      expect(res.body).toMatchObject({
        miRol: 'coordinador',
        miEstadoJurado: 'activo',
      });
    });

    it('rejects a duplicate judge, an inactive user and dimensions outside the project', async () => {
      const p = await crearProyecto();
      const juez = await t.usuario('invitado');
      await agregarJurado(p.id, juez.id);
      await t
        .http()
        .post(`/api/proyectos/${p.id}/jurados`)
        .set(coord.auth)
        .send({ idUsuario: juez.id })
        .expect(409);
      const baja = await t.usuario('invitado');
      await t.prisma.usuario.update({
        where: { id: baja.id },
        data: { activo: false },
      });
      await t
        .http()
        .post(`/api/proyectos/${p.id}/jurados`)
        .set(coord.auth)
        .send({ idUsuario: baja.id })
        .expect(404);
      const otro = await t.usuario('invitado');
      await t
        .http()
        .post(`/api/proyectos/${p.id}/jurados`)
        .set(coord.auth)
        .send({ idUsuario: otro.id, idDimensiones: [cat.org.id] })
        .expect(400);
    });

    it('finalizes a judge and removes one without answers', async () => {
      const p = await crearProyecto();
      const a = await t.usuario('invitado');
      const b = await t.usuario('invitado');
      await agregarJurado(p.id, a.id);
      await agregarJurado(p.id, b.id);
      const fin = await t
        .http()
        .patch(`/api/proyectos/${p.id}/jurados/${a.id}`)
        .set(coord.auth)
        .send({ estado: 'finalizado' })
        .expect(200);
      expect(
        fin.body.jurados.find(
          (j: { idUsuario: number }) => j.idUsuario === a.id,
        ).estado,
      ).toBe('finalizado');
      const del = await t
        .http()
        .delete(`/api/proyectos/${p.id}/jurados/${b.id}`)
        .set(coord.auth)
        .expect(200);
      expect(del.body.jurados).toHaveLength(1);
    });

    it('answers 201 and 409 (never 500) to two simultaneous invitations of the same user', async () => {
      const p = await crearProyecto();
      const juez = await t.usuario('invitado');
      const invitar = () =>
        t
          .http()
          .post(`/api/proyectos/${p.id}/jurados`)
          .set(coord.auth)
          .send({ idUsuario: juez.id });
      const codigos = (await Promise.all([invitar(), invitar()]))
        .map((r) => r.status)
        .sort();
      expect(codigos).toEqual([201, 409]);
      expect(await t.prisma.juradoProyecto.count()).toBe(1);
    });

    it('does not find inactive or unknown users', async () => {
      await t
        .http()
        .get('/api/usuarios/buscar?email=nadie@x.com')
        .set(coord.auth)
        .expect(404);
    });
  });

  describe('state transitions', () => {
    it('needs at least one judge to start', async () => {
      const p = await crearProyecto();
      const res = await t
        .http()
        .post(`/api/proyectos/${p.id}/estado`)
        .set(coord.auth)
        .send({ estado: 'en_curso' })
        .expect(409);
      expect(res.body.message).toBe('El proyecto necesita al menos un jurado');
      const juez = await t.usuario('invitado');
      await agregarJurado(p.id, juez.id);
      const ok = await t
        .http()
        .post(`/api/proyectos/${p.id}/estado`)
        .set(coord.auth)
        .send({ estado: 'en_curso' })
        .expect(200);
      expect(ok.body.estado).toBe('en_curso');
    });

    it('cannot close without results, and a closed project rejects every write', async () => {
      const p = await crearProyecto();
      await agregarJurado(p.id, coord.id);
      await t
        .http()
        .post(`/api/proyectos/${p.id}/estado`)
        .set(coord.auth)
        .send({ estado: 'en_curso' })
        .expect(200);
      const res = await t
        .http()
        .post(`/api/proyectos/${p.id}/estado`)
        .set(coord.auth)
        .send({ estado: 'cerrado' })
        .expect(409);
      expect(res.body.message).toBe('Genera los resultados antes de cerrar');

      // Simulate generated results to reach the closed state.
      await t.prisma.informeEvaluacion.create({
        data: { idProyecto: p.id, version: 1, fotoCalificaciones: {} },
      });
      await t
        .http()
        .post(`/api/proyectos/${p.id}/estado`)
        .set(coord.auth)
        .send({ estado: 'cerrado' })
        .expect(200);
      const cerrado = await t
        .http()
        .patch(`/api/proyectos/${p.id}`)
        .set(coord.auth)
        .send({ nombre: 'Otro' })
        .expect(409);
      expect(cerrado.body.message).toBe('El proyecto está cerrado');
      await t
        .http()
        .post(`/api/proyectos/${p.id}/softwares`)
        .set(coord.auth)
        .send({ nombre: 'X' })
        .expect(409);
    });

    it('removes software only in draft', async () => {
      const p = await crearProyecto();
      await agregarJurado(p.id, coord.id);
      await t
        .http()
        .post(`/api/proyectos/${p.id}/estado`)
        .set(coord.auth)
        .send({ estado: 'en_curso' })
        .expect(200);
      await t
        .http()
        .delete(`/api/proyectos/${p.id}/softwares/${p.softwares[0].id}`)
        .set(coord.auth)
        .expect(409);
    });
  });
});
