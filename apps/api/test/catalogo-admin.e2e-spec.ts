import {
  crearOrganizacion,
  crearProyectoEnCurso,
  seedCatalogo,
} from './fixtures';
import { createTestContext, TestContext } from './helpers';

type Usuario = Awaited<ReturnType<TestContext['usuario']>>;

/** Catalog administration and IS computed by the server (RF-18, RF-22, RF-24, HU-22 to HU-24). */
describe('Catalog administration and IS (e2e, test database)', () => {
  let t: TestContext;
  let cat: Awaited<ReturnType<typeof seedCatalogo>>;
  let admin: Usuario;

  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(async () => {
    await t.reset();
    cat = await seedCatalogo(t.prisma);
    // Anchor spread of the specification example (section 6): rq1 1.56, rq2 2.00, rq3 2.10.
    await t.prisma.catalogoVersion.update({
      where: { id: cat.version.id },
      data: { rq1: 1.56, rq2: 2, rq3: 2.1 },
    });
    admin = await t.usuario('administrador');
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  const nuevo = (citas: number[], extra: object = {}) => ({
    idDimension: cat.tec.id,
    nombre: 'Integración con modelos de IA',
    alcanceDefault: 'externo',
    subfactores: citas.map((c, i) => ({
      texto: `Subfactor ${i + 1}`,
      citas: c,
    })),
    ...extra,
  });
  const crear = (body: object, u = admin) =>
    t.http().post('/api/catalogo/factores').set(u.auth).send(body);

  it('HU-22: 7 citations in 3 subfactors give r 2.33, IL 4 and IS 3, flagged as sensitive', async () => {
    const res = await crear(nuevo([3, 2, 2])).expect(201);
    expect(res.body).toMatchObject({
      estado: 'propuesta',
      modo: 'manual',
      tc: 7,
      ns: 3,
      il: 4,
      isPropuesta: 3,
      isAprobada: null,
      resultadoSensible: true,
      sinEvidencia: false,
      sinRespaldoVerificable: true,
      cortes: { rq1: 1.56, rq2: 2, rq3: 2.1 },
      factor: {
        nombre: 'Integración con modelos de IA',
        idDimension: cat.tec.id,
        alcanceDefault: 'externo',
      },
    });
    expect(res.body.r).toBeCloseTo(2.333, 3);
    expect(res.body.subfactores.map((s: { citas: number }) => s.citas)).toEqual(
      [3, 2, 2],
    );

    const factor = await t.prisma.factor.findUniqueOrThrow({
      where: { id: res.body.factor.id },
    });
    expect(factor).toMatchObject({
      activo: false,
      origen: 'lit_2020_2025',
      validadoExpertos: false,
    });
    const vigente = await t
      .http()
      .get('/api/catalogo/vigente')
      .set(admin.auth)
      .expect(200);
    expect(JSON.stringify(vigente.body)).not.toContain(
      'Integración con modelos de IA',
    );
  });

  it('flags "no evidence" when there are no citations: r 0, IL 1, IS 2', async () => {
    const res = await crear(nuevo([0, 0])).expect(201);
    expect(res.body).toMatchObject({
      tc: 0,
      r: 0,
      il: 1,
      isPropuesta: 2,
      sinEvidencia: true,
    });
  });

  it('counts a subfactor with DOIs as backed by verifiable references', async () => {
    const body = nuevo([1], {
      subfactores: [
        { texto: 'Con DOI', citas: 1, dois: ['https://doi.org/10.1000/ABC'] },
      ],
    });
    const res = await crear(body).expect(201);
    expect(res.body.sinRespaldoVerificable).toBe(false);
    expect(res.body.subfactores[0].dois).toEqual(['10.1000/abc']);
  });

  it.each([
    [{ subfactores: [] }],
    [{ subfactores: [{ texto: 'x', citas: -1 }] }],
    [{ subfactores: [{ texto: 'x', citas: 1.5 }] }],
    [{ subfactores: [{ texto: 'x', citas: 1, dois: ['no-es-doi'] }] }],
    [{ idDimension: 999999 }],
    [{ alcanceDefault: 'ambos' }],
  ])('rejects %j with 400 and creates nothing', async (bad) => {
    await crear(nuevo([1], bad)).expect(400);
    expect(await t.prisma.estimacionIs.count()).toBe(0);
    expect(await t.prisma.factor.count({ where: { activo: false } })).toBe(1); // only the seeded one
  });

  it.each(['coordinador', 'invitado'] as const)('forbids a %s', async (rol) => {
    const u = await t.usuario(rol);
    await crear(nuevo([1]), u).expect(403);
    await t.http().get('/api/catalogo/factores').set(u.auth).expect(403);
  });

  it('HU-23/HU-24: approving with corrected citations recomputes the IS, activates the factor and publishes a new version', async () => {
    const org = await crearOrganizacion(t.prisma);
    const coord = await t.usuario('coordinador', { idOrganizacion: org.id });
    const p = await crearProyectoEnCurso(t.prisma, cat, coord.id, org.id, [
      coord.id,
    ]);

    const est = (await crear(nuevo([3, 2, 2])).expect(201)).body;
    const res = await t
      .http()
      .post(`/api/catalogo/estimaciones/${est.id}/aprobar`)
      .set(admin.auth)
      .send({
        citas: est.subfactores.map((s: { id: number }) => ({
          idSubfactor: s.id,
          citas: 2,
        })),
      })
      .expect(200);
    expect(res.body).toMatchObject({
      estado: 'aprobada',
      tc: 6,
      r: 2,
      il: 2,
      isPropuesta: 2,
      isAprobada: 2,
    });

    const factor = await t.prisma.factor.findUniqueOrThrow({
      where: { id: est.factor.id },
    });
    expect(factor).toMatchObject({
      activo: true,
      sugeridaDefault: 2,
      isOrigen: 'manual',
    });
    const versiones = await t
      .http()
      .get('/api/catalogo/versiones')
      .set(admin.auth)
      .expect(200);
    expect(versiones.body.map((v: { numero: number }) => v.numero)).toEqual([
      2, 1,
    ]);
    const vigente = await t
      .http()
      .get('/api/catalogo/vigente')
      .set(admin.auth)
      .expect(200);
    expect(vigente.body.version).toMatchObject({
      numero: 2,
      rq1: 1.56,
      rq2: 2,
      rq3: 2.1,
    });
    // Existing projects keep their catalog version.
    const proyecto = await t.prisma.proyectoEvaluacion.findUniqueOrThrow({
      where: { id: p.id },
    });
    expect(proyecto.idCatalogoVersion).toBe(cat.version.id);
    // Only proposals can be decided.
    await t
      .http()
      .post(`/api/catalogo/estimaciones/${est.id}/rechazar`)
      .set(admin.auth)
      .send({ justificacion: 'x' })
      .expect(409);
  });

  it('two simultaneous approvals: one wins, the other gets 409 and only one version is published', async () => {
    const est = (await crear(nuevo([3, 2, 2])).expect(201)).body;
    const url = `/api/catalogo/estimaciones/${est.id}/aprobar`;
    const codigos = (
      await Promise.all([
        t.http().post(url).set(admin.auth).send({}),
        t.http().post(url).set(admin.auth).send({}),
      ])
    )
      .map((r) => r.status)
      .sort();
    expect(codigos).toEqual([200, 409]);
    expect(await t.prisma.catalogoVersion.count()).toBe(2);
  });

  it('refuses to activate a factor whose estimation is still pending', async () => {
    const est = (await crear(nuevo([1])).expect(201)).body;
    const res = await t
      .http()
      .patch(`/api/catalogo/factores/${est.factor.id}`)
      .set(admin.auth)
      .send({ activo: true })
      .expect(409);
    expect(res.body.message).toBe(
      'El factor tiene una estimación pendiente; apruébala o recházala',
    );
    expect(
      (
        await t.prisma.factor.findUniqueOrThrow({
          where: { id: est.factor.id },
        })
      ).activo,
    ).toBe(false);
  });

  it('an approved IS different from the computed one requires a justification', async () => {
    const est = (await crear(nuevo([3, 2, 2])).expect(201)).body;
    const url = `/api/catalogo/estimaciones/${est.id}/aprobar`;
    await t
      .http()
      .post(url)
      .set(admin.auth)
      .send({ isAprobada: 4 })
      .expect(400);
    const res = await t
      .http()
      .post(url)
      .set(admin.auth)
      .send({ isAprobada: 4, justificacion: 'Evidencia reciente' })
      .expect(200);
    expect(res.body).toMatchObject({
      isPropuesta: 3,
      isAprobada: 4,
      justificacion: 'Evidencia reciente',
    });
    const factor = await t.prisma.factor.findUniqueOrThrow({
      where: { id: est.factor.id },
    });
    expect(factor.sugeridaDefault).toBe(4);
  });

  it('rejecting needs a justification and keeps the factor inactive', async () => {
    const est = (await crear(nuevo([1])).expect(201)).body;
    const url = `/api/catalogo/estimaciones/${est.id}/rechazar`;
    await t.http().post(url).set(admin.auth).send({}).expect(400);
    const res = await t
      .http()
      .post(url)
      .set(admin.auth)
      .send({ justificacion: 'Sin sustento' })
      .expect(200);
    expect(res.body).toMatchObject({
      estado: 'rechazada',
      justificacion: 'Sin sustento',
    });
    expect(
      (
        await t.prisma.factor.findUniqueOrThrow({
          where: { id: est.factor.id },
        })
      ).activo,
    ).toBe(false);
    const lista = await t
      .http()
      .get('/api/catalogo/estimaciones?estado=propuesta')
      .set(admin.auth)
      .expect(200);
    expect(lista.body).toEqual([]);
  });

  it('edits and deactivates factors and subfactors (RF-18)', async () => {
    const id = cat.usabilidad.id;
    const f = await t
      .http()
      .patch(`/api/catalogo/factores/${id}`)
      .set(admin.auth)
      .send({ nombre: 'Usabilidad general', activo: false })
      .expect(200);
    expect(f.body).toMatchObject({
      id,
      nombre: 'Usabilidad general',
      activo: false,
    });
    const vigente = await t
      .http()
      .get('/api/catalogo/vigente')
      .set(admin.auth)
      .expect(200);
    expect(JSON.stringify(vigente.body)).not.toContain('Usabilidad general');

    const s = await t
      .http()
      .post(`/api/catalogo/factores/${id}/subfactores`)
      .set(admin.auth)
      .send({ texto: 'Accesibilidad' })
      .expect(201);
    expect(s.body).toMatchObject({ texto: 'Accesibilidad', activo: true });
    const s2 = await t
      .http()
      .patch(`/api/catalogo/subfactores/${s.body.id}`)
      .set(admin.auth)
      .send({ activo: false })
      .expect(200);
    expect(s2.body.activo).toBe(false);

    const todos = await t
      .http()
      .get('/api/catalogo/factores')
      .set(admin.auth)
      .expect(200);
    const usab = todos.body.find((x: { id: number }) => x.id === id);
    expect(usab.subfactores.map((x: { texto: string }) => x.texto)).toContain(
      'Accesibilidad',
    );
    await t
      .http()
      .patch('/api/catalogo/factores/999999')
      .set(admin.auth)
      .send({ activo: false })
      .expect(404);
  });

  it('AI estimation answers 409 when no AI is configured', async () => {
    const res = await t
      .http()
      .post(`/api/catalogo/factores/${cat.usabilidad.id}/estimaciones`)
      .set(admin.auth)
      .expect(409);
    expect(res.body.message).toBe('La estimación con IA no está configurada');
  });
});
