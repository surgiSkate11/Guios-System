import {
  crearOrganizacion,
  crearProyectoEnCurso,
  seedCatalogo,
} from './fixtures';
import { createTestContext, TestContext } from './helpers';

type Usuario = Awaited<ReturnType<TestContext['usuario']>>;

describe('Results, comparison and audit A6 (e2e, test database)', () => {
  let t: TestContext;
  let cat: Awaited<ReturnType<typeof seedCatalogo>>;
  let coord: Usuario;
  let j1: Usuario;
  let j2: Usuario;
  let p: Awaited<ReturnType<typeof crearProyectoEnCurso>>;

  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(async () => {
    await t.reset();
    cat = await seedCatalogo(t.prisma);
    const org = await crearOrganizacion(t.prisma);
    coord = await t.usuario('coordinador', { idOrganizacion: org.id });
    j1 = await t.usuario('invitado', { nombre: 'Juez 1' });
    j2 = await t.usuario('invitado', { nombre: 'Juez 2' });
    p = await crearProyectoEnCurso(t.prisma, cat, coord.id, org.id, [
      j1.id,
      j2.id,
    ]);
    // Usabilidad: IS 3, ID 3 -> IR 3 (relevant). Documentación: IS 2, ID 1 -> IR 1 (not relevant).
    for (const u of [j1, j2]) {
      await importancia(u, p.pfUsabilidad, 3);
      await importancia(u, p.pfDocumentacion, 1);
    }
    await t
      .http()
      .post(url('/consolidacion/confirmar'))
      .set(coord.auth)
      .expect(201);
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  const url = (path: string) => `/api/proyectos/${p.id}${path}`;
  const importancia = (u: Usuario, idPf: number, impDecisor: number) =>
    t
      .http()
      .put(url(`/importancias/${idPf}`))
      .set(u.auth)
      .send({ impDecisor })
      .expect(200);
  const subs = () => cat.usabilidad.subfactores.map((s) => s.id);

  async function calificar(
    u: Usuario,
    idSoftware: number,
    valores: (number | 'D')[],
  ) {
    for (const [i, v] of valores.entries()) {
      const body = v === 'D' ? { desconozco: true } : { valor: v };
      await t
        .http()
        .put(url('/calificaciones'))
        .set(u.auth)
        .send({ idSoftware, idSubfactor: subs()[i], ...body })
        .expect(200);
    }
  }

  async function calificarTodo() {
    const [a, b] = p.softwares;
    await calificar(j1, a.id, [4, 4]);
    await calificar(j2, a.id, [4, 3]);
    await calificar(j1, b.id, [1, 2]);
    await calificar(j2, b.id, [2, 2]);
  }

  it('reports how many relevant factors are missing (RF-13)', async () => {
    await calificar(j1, p.softwares[0].id, [4, 4]);
    const res = await t
      .http()
      .get(url('/resultados/vista-previa'))
      .set(coord.auth)
      .expect(409);
    expect(res.body).toMatchObject({
      message: 'Faltan 2 factores relevantes por evaluar',
      faltantes: 2,
    });
    await t.http().post(url('/resultados')).set(coord.auth).expect(409);
    expect(await t.prisma.informeEvaluacion.count()).toBe(0);
  });

  it('computes PM, SWOT, metrics, level and ranking with @guios/calculo (RF-09 to RF-12)', async () => {
    await calificarTodo();
    const res = await t
      .http()
      .get(url('/resultados/vista-previa'))
      .set(coord.auth)
      .expect(200);
    expect(res.body.generadoEn).toBeNull();
    expect(res.body.banderas).toEqual([]);
    const [a, b] = res.body.softwares;

    expect(a).toMatchObject({ nombre: 'Software A', ranking: 1, nivel: 'A' });
    expect(a.metrica.final).toBeCloseTo(91.667, 2);
    expect(a.metrica.minimo).toBeCloseTo(83.333, 2);
    expect(a.metrica.maximo).toBe(100);
    expect(a.metrica.desviacion).toBeCloseTo(8.333, 2);
    expect(a.scoresJurado.map((s: { score: number }) => s.score)).toEqual([
      100,
      expect.closeTo(83.333, 2),
    ]);
    expect(a.factores).toEqual([
      {
        idProyectoFactor: p.pfUsabilidad,
        nombre: 'Usabilidad',
        ir: 3,
        alcance: 'externo',
        pmPorJurado: [
          { idUsuario: j1.id, pm: 4 },
          { idUsuario: j2.id, pm: 3.5 },
        ],
        pmConsolidada: 3.75,
        foda: 'oportunidad',
      },
    ]);

    expect(b).toMatchObject({ nombre: 'Software B', ranking: 2, nivel: 'C' });
    expect(b.metrica.final).toBeCloseTo(25, 6);
    expect(b.factores[0]).toMatchObject({
      pmConsolidada: 1.75,
      foda: 'amenaza',
    });
  });

  it('uses the effective scope: an internal factor becomes strength or weakness', async () => {
    await t
      .http()
      .patch(url(`/factores/${p.pfUsabilidad}/alcance`))
      .set(coord.auth)
      .send({ alcance: 'interno', justificacion: 'Depende de la organización' })
      .expect(200);
    await calificarTodo();
    const res = await t
      .http()
      .get(url('/resultados/vista-previa'))
      .set(coord.auth)
      .expect(200);
    expect(
      res.body.softwares.map(
        (s: { factores: { foda: string }[] }) => s.factores[0].foda,
      ),
    ).toEqual(['fortaleza', 'debilidad']);
  });

  it('flags uncertain data when a judge answers "Desconozco" over 25 %', async () => {
    const [a, b] = p.softwares;
    await calificar(j1, a.id, [4, 4]);
    await calificar(j2, a.id, [4, 'D']);
    await calificar(j1, b.id, [1, 2]);
    await calificar(j2, b.id, [2, 'D']);
    const res = await t
      .http()
      .get(url('/resultados/vista-previa'))
      .set(coord.auth)
      .expect(200);
    expect(res.body.banderas).toEqual([
      expect.objectContaining({
        tipo: 'datos_inciertos',
        idUsuario: j2.id,
        mensaje: expect.any(String),
      }),
    ]);
  });

  it('persists a new report version, serves it to judges and allows closing', async () => {
    await calificarTodo();
    const first = await t
      .http()
      .post(url('/resultados'))
      .set(coord.auth)
      .expect(201);
    expect(first.body.generadoEn).toEqual(expect.any(String));
    await t.http().post(url('/resultados')).set(coord.auth).expect(201);
    expect(await t.prisma.informeEvaluacion.count()).toBe(2);
    expect(await t.prisma.resultadoSoftware.count()).toBe(2);

    const stored = await t
      .http()
      .get(url('/resultados'))
      .set(j1.auth)
      .expect(200);
    expect(stored.body.softwares[0].metrica.final).toBeCloseTo(91.667, 2);

    const mio = await t
      .http()
      .get(url('/resultados/mio'))
      .set(j2.auth)
      .expect(200);
    expect(mio.body.softwares[0]).toMatchObject({
      nombre: 'Software A',
      score: expect.closeTo(83.333, 2),
    });
    expect(mio.body.softwares[0].factores[0]).toMatchObject({
      pm: 3.5,
      foda: 'oportunidad',
    });

    await t
      .http()
      .post(url('/estado'))
      .set(coord.auth)
      .send({ estado: 'cerrado' })
      .expect(200);
    await t.http().post(url('/resultados')).set(coord.auth).expect(409);
  });

  it('answers 404 before any result and restricts generation to the coordinator', async () => {
    await t.http().get(url('/resultados')).set(coord.auth).expect(404);
    await t.http().get(url('/resultados/mio')).set(j1.auth).expect(404);
    await t
      .http()
      .get(url('/resultados/vista-previa'))
      .set(j1.auth)
      .expect(403);
    await t.http().post(url('/resultados')).set(j1.auth).expect(403);
  });

  it('audits each judge: importances, "Desconozco" share and scores (RF-20)', async () => {
    const [a] = p.softwares;
    await calificar(j1, a.id, [4, 'D']);
    const res = await t
      .http()
      .get(url('/auditoria'))
      .set(coord.auth)
      .expect(200);
    const [aud1, aud2] = res.body.jurados;
    expect(aud1).toMatchObject({
      idUsuario: j1.id,
      nombre: 'Juez 1',
      estado: 'activo',
      calificaciones: { total: 2, desconozco: 1, porcentajeDesconozco: 50 },
    });
    expect(aud1.importancias).toEqual([
      { idProyectoFactor: p.pfUsabilidad, factor: 'Usabilidad', impDecisor: 3 },
      {
        idProyectoFactor: p.pfDocumentacion,
        factor: 'Documentación',
        impDecisor: 1,
      },
    ]);
    expect(aud1.scores[0]).toEqual({ idSoftware: a.id, score: 100 });
    expect(aud2.calificaciones).toEqual({
      total: 0,
      desconozco: 0,
      porcentajeDesconozco: 0,
    });
    await t.http().get(url('/auditoria')).set(j1.auth).expect(403);
  });
});
