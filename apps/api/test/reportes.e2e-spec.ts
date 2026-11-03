import {
  crearOrganizacion,
  crearProyectoEnCurso,
  seedCatalogo,
} from './fixtures';
import { createTestContext, TestContext } from './helpers';

type Usuario = Awaited<ReturnType<TestContext['usuario']>>;

/** PDF export (RF-19) and AI analysis with fallback text (RF-16). */
describe('Reports: PDF and AI analysis (e2e, test database)', () => {
  let t: TestContext;
  let cat: Awaited<ReturnType<typeof seedCatalogo>>;
  let coord: Usuario;
  let j1: Usuario;
  let p: Awaited<ReturnType<typeof crearProyectoEnCurso>>;

  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(async () => {
    await t.reset();
    cat = await seedCatalogo(t.prisma);
    const org = await crearOrganizacion(t.prisma);
    coord = await t.usuario('coordinador', { idOrganizacion: org.id });
    j1 = await t.usuario('invitado', {
      nombre: 'Ana Pérez',
      email: 'ana.perez@org.com',
    });
    p = await crearProyectoEnCurso(t.prisma, cat, coord.id, org.id, [j1.id]);
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  const url = (path: string) => `/api/proyectos/${p.id}${path}`;

  async function generarResultados() {
    await t
      .http()
      .put(url(`/importancias/${p.pfUsabilidad}`))
      .set(j1.auth)
      .send({ impDecisor: 3 })
      .expect(200);
    await t
      .http()
      .put(url(`/importancias/${p.pfDocumentacion}`))
      .set(j1.auth)
      .send({ impDecisor: 1 })
      .expect(200);
    await t
      .http()
      .post(url('/consolidacion/confirmar'))
      .set(coord.auth)
      .expect(201);
    for (const [sw, valor] of [
      [p.softwares[0], 4],
      [p.softwares[1], 1],
    ] as const) {
      for (const s of cat.usabilidad.subfactores) {
        await t
          .http()
          .put(url('/calificaciones'))
          .set(j1.auth)
          .send({ idSoftware: sw.id, idSubfactor: s.id, valor })
          .expect(200);
      }
    }
    await t.http().post(url('/resultados')).set(coord.auth).expect(201);
  }

  const binario = (
    res: import('supertest').Response,
    cb: (err: Error | null, body: Buffer) => void,
  ) => {
    const partes: Buffer[] = [];
    res.on('data', (c: Buffer) => partes.push(c));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  };

  describe('PDF (RF-19)', () => {
    it('answers 404 before results, 403 to a judge and 404 to outsiders', async () => {
      await t.http().get(url('/resultados/pdf')).set(coord.auth).expect(404);
      await generarResultados();
      await t.http().get(url('/resultados/pdf')).set(j1.auth).expect(403);
      const ajeno = await t.usuario('coordinador', {
        idOrganizacion: (await crearOrganizacion(t.prisma, 'Otra')).id,
      });
      await t.http().get(url('/resultados/pdf')).set(ajeno.auth).expect(404);
    });

    it('returns a PDF document for the coordinator', async () => {
      await generarResultados();
      const res = await t
        .http()
        .get(url('/resultados/pdf'))
        .set(coord.auth)
        .buffer(true)
        .parse(binario)
        .expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain(
        `resultado-proyecto-${p.id}.pdf`,
      );
      const body = res.body as Buffer;
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(body.length).toBeGreaterThan(1000);
    });
  });

  describe('AI analysis (RF-16)', () => {
    it('falls back to a template text when no AI is configured, and stores input and output (RNF-06, RNF-07)', async () => {
      await t.http().get(url('/analisis')).set(coord.auth).expect(404);
      await generarResultados();
      const res = await t
        .http()
        .post(url('/analisis'))
        .set(coord.auth)
        .expect(201);
      expect(res.body).toMatchObject({
        estado: 'fallido',
        respaldo: true,
        modelo: 'respaldo',
      });
      expect(res.body.texto).toContain('Software A');
      expect(res.body.texto).toContain('nivel A');

      const fila = await t.prisma.analisisIa.findFirstOrThrow({
        where: { idProyecto: p.id },
      });
      const entrada = JSON.stringify(fila.entrada);
      // RNF-05: judges are pseudonymized before anything leaves the server.
      expect(entrada).toContain('Jurado 1');
      expect(entrada).not.toContain('Ana Pérez');
      expect(entrada).not.toContain('ana.perez@org.com');
      expect(fila.salida).toBe(res.body.texto);

      const ultimo = await t
        .http()
        .get(url('/analisis'))
        .set(j1.auth)
        .expect(200);
      expect(ultimo.body.id).toBe(res.body.id);
    });

    it('answers 404 without results and 403 to a judge', async () => {
      await t.http().post(url('/analisis')).set(coord.auth).expect(404);
      await generarResultados();
      await t.http().post(url('/analisis')).set(j1.auth).expect(403);
    });
  });
});
