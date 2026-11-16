import type { Articulo, Bibliografia } from '../src/catalogo/bibliografia';
import { BIBLIOGRAFIA } from '../src/catalogo/bibliografia';
import { IA_CLIENTE, type IaCliente } from '../src/ia/ia-cliente';
import { seedCatalogo } from './fixtures';
import { createTestContext, TestContext } from './helpers';

const RESUMEN =
  'This study shows that intuitive interfaces reduce training time in ERP adoption.';
const art = (doi: string, extra: Partial<Articulo> = {}): Articulo => ({
  doi: `https://doi.org/${doi}`,
  titulo: `Article ${doi}`,
  anio: 2023,
  tipo: 'article',
  resumen: RESUMEN,
  ...extra,
});

/**
 * The number of valid articles depends on the factor, so each anchor gets a different r:
 * Usabilidad 3 articles x 2 subfactors -> r 3; Documentación -> r 2; Formación -> r 1;
 * Integración con IA 4 articles x 2 subfactors -> r 4 (only used by the incremental case).
 */
const VALIDOS: Record<string, number> = {
  Usabilidad: 3,
  Documentación: 2,
  Formación: 1,
  'Integración con IA': 4,
};
const PREFIJO: Record<string, string> = {
  Usabilidad: 'u',
  Documentación: 'd',
  Formación: 'f',
  'Integración con IA': 'i',
};

class FakeBibliografia implements Bibliografia {
  /** Fails when the query contains this factor name (RNF-06). */
  fallarEn: string | null = null;
  /** Keeps the job running long enough to observe it (RNF-12). */
  demora = 0;
  consultas: string[] = [];

  async buscar(consulta: string): Promise<Articulo[]> {
    this.consultas.push(consulta);
    if (this.demora > 0) await new Promise((r) => setTimeout(r, this.demora));
    const nombre = Object.keys(VALIDOS).find((n) => consulta.includes(n));
    if (!nombre) return [];
    if (this.fallarEn === nombre) throw new Error('OpenAlex down');
    const prefijo = PREFIJO[nombre];
    const articulos = Array.from({ length: VALIDOS[nombre] }, (_, i) =>
      art(`10.1000/${prefijo}${i + 1}`),
    );
    // Out of the 2020-2025 window and a non-article: the server discards both (RN-14).
    return [
      ...articulos,
      art(`10.1000/${prefijo}viejo`, { anio: 2019 }),
      art(`10.1000/${prefijo}norma`, { tipo: 'standard' }),
    ];
  }
}

/** The AI only classifies; the server counts citations and computes cuts and IL (RNF-11). */
class FakeIa implements IaCliente {
  readonly modelo = 'fake-model';
  completar(_instrucciones: string, entrada: string): Promise<string> {
    const { candidatos } = JSON.parse(entrada) as {
      candidatos: { i: number }[];
    };
    return Promise.resolve(
      JSON.stringify(
        candidatos.map((c) => ({
          i: c.i,
          respalda: true,
          cita: 'intuitive interfaces reduce training time',
        })),
      ),
    );
  }
}

describe('Anchor measurement (e2e, test database)', () => {
  let t: TestContext;
  const biblio = new FakeBibliografia();
  const ia = new FakeIa();
  let cat: Awaited<ReturnType<typeof seedCatalogo>>;
  let admin: Awaited<ReturnType<TestContext['usuario']>>;

  beforeAll(async () => {
    t = await createTestContext((b) =>
      b
        .overrideProvider(BIBLIOGRAFIA)
        .useValue(biblio)
        .overrideProvider(IA_CLIENTE)
        .useValue(ia),
    );
  });
  beforeEach(async () => {
    await t.reset();
    biblio.fallarEn = null;
    biblio.demora = 0;
    biblio.consultas.length = 0;
    cat = await seedCatalogo(t.prisma);
    admin = await t.usuario('administrador');
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  async function esperarMedicion() {
    for (let i = 0; i < 100; i++) {
      const res = await t
        .http()
        .get('/api/catalogo/anclas')
        .set(admin.auth)
        .expect(200);
      if (res.body.estado !== 'en_curso') return res.body;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('anchor measurement did not finish');
  }

  async function medir() {
    await t
      .http()
      .post('/api/catalogo/anclas/medir')
      .set(admin.auth)
      .expect(202);
    return esperarMedicion();
  }

  it('is restricted to administrators (RNF-08)', async () => {
    await t.http().post('/api/catalogo/anclas/medir').expect(401);
    await t.http().get('/api/catalogo/anclas').expect(401);

    const coordinador = await t.usuario('coordinador');
    await t
      .http()
      .post('/api/catalogo/anclas/medir')
      .set(coordinador.auth)
      .expect(403);
    await t
      .http()
      .get('/api/catalogo/anclas')
      .set(coordinador.auth)
      .expect(403);
  });

  it('reports the cuts of the current version and no anchors before measuring', async () => {
    const res = await t
      .http()
      .get('/api/catalogo/anclas')
      .set(admin.auth)
      .expect(200);
    expect(res.body).toMatchObject({
      estado: 'inactiva',
      progreso: null,
      factorActual: null,
      error: null,
      version: { id: cat.version.id, numero: 1 },
      cortes: { rq1: 1.86, rq2: 3.65, rq3: 4.78 },
      dispersion: null,
      anclas: [],
    });
  });

  it('measures every active factor and publishes a new version with quartile cuts (RN-02, section 6)', async () => {
    const inicio = await t
      .http()
      .post('/api/catalogo/anclas/medir')
      .set(admin.auth)
      .expect(202);
    expect(inicio.body).toMatchObject({
      estado: 'en_curso',
      progreso: { hechos: 0, total: 3 },
      error: null,
    });

    const fin = await esperarMedicion();
    expect(fin).toMatchObject({
      estado: 'completada',
      progreso: null,
      factorActual: null,
      error: null,
      version: { numero: 2 },
      anclas: [
        {
          idFactor: cat.usabilidad.id,
          nombre: 'Usabilidad',
          citas: 6,
          ns: 2,
          r: 3,
        },
        {
          idFactor: cat.documentacion.id,
          nombre: 'Documentación',
          citas: 4,
          ns: 2,
          r: 2,
        },
        {
          idFactor: cat.formacion.id,
          nombre: 'Formación',
          citas: 2,
          ns: 2,
          r: 1,
        },
      ],
    });
    // QUARTILE.INC over [1, 2, 3]: q1 = 1.5, q2 = 2, q3 = 2.5.
    expect(fin.cortes).toEqual({ rq1: 1.5, rq2: 2, rq3: 2.5 });
    expect(fin.dispersion).toMatchObject({
      minimo: 1,
      maximo: 3,
      mediana: 2,
      promedio: 2,
    });
    expect(fin.dispersion.desviacion).toBeCloseTo(0.8165, 3);

    // The inactive factor is never measured and no search leaves the 2020-2025 window.
    expect(biblio.consultas.join(' ')).not.toContain('Retirado');
    expect(biblio.consultas).toHaveLength(6);

    const version = await t.prisma.catalogoVersion.findMany({
      orderBy: { numero: 'asc' },
    });
    expect(version).toHaveLength(2);
    // Version 1 keeps its original cuts: projects keep the version they started with (RF-17).
    expect(version[0]).toMatchObject({
      numero: 1,
      rq1: 1.86,
      rq2: 3.65,
      rq3: 4.78,
    });
    expect(version[1]).toMatchObject({
      numero: 2,
      rq1: 1.5,
      rq2: 2,
      rq3: 2.5,
      creadoPorId: admin.id,
    });

    const anclas = await t.prisma.medicionAncla.findMany({
      where: { idCatalogoVersion: version[1].id },
      orderBy: { idFactor: 'asc' },
    });
    expect(anclas).toHaveLength(3);
    expect(anclas.map((a) => a.r)).toEqual([3, 2, 1]);
    expect(
      anclas.every((a) => a.periodoDesde === 2020 && a.periodoHasta === 2025),
    ).toBe(true);
    expect(anclas.every((a) => a.terminosBusqueda !== null)).toBe(true);

    // The temporary estimations are rejected so the factors stay editable.
    const pendientes = await t.prisma.estimacionIs.count({
      where: { estado: { in: ['en_curso', 'propuesta'] } },
    });
    expect(pendientes).toBe(0);
    const rechazadas = await t.prisma.estimacionIs.findMany({
      where: { estado: 'rechazada' },
    });
    expect(rechazadas).toHaveLength(3);
    expect(rechazadas[0].justificacion).toContain('Medición de anclas');
  });

  it('estimates a new factor with the published cuts without re-measuring the anchors', async () => {
    await medir();
    const consultasDocumentacion = () =>
      biblio.consultas.filter((c) => c.includes('Documentación')).length;
    const antes = consultasDocumentacion();
    expect(antes).toBe(2);

    const inicio = await t
      .http()
      .post(`/api/catalogo/factores/${cat.usabilidad.id}/estimaciones`)
      .set(admin.auth)
      .expect(202);
    let fin: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) {
      const res = await t
        .http()
        .get(`/api/catalogo/estimaciones/${inicio.body.id}`)
        .set(admin.auth)
        .expect(200);
      fin = res.body;
      if (fin.estado !== 'en_curso') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    // r = 6 / 2 = 3. With the new cuts (1.5, 2, 2.5) it is IL 4 -> IS matriz(3, 4) = 3;
    // with the old ones it would have been 2.
    expect(fin).toMatchObject({ r: 3, il: 4, isPropuesta: 3 });
    expect(consultasDocumentacion()).toBe(antes);
  });

  it('measures only the new factors and keeps the published anchors (incremental)', async () => {
    const primera = await medir();
    expect(primera.anclas).toHaveLength(3);
    const consultasAntes = biblio.consultas.length;
    expect(consultasAntes).toBe(6);

    // A new factor enters the catalog: only it must be measured on the next run.
    const nuevo = await t.prisma.factor.create({
      data: {
        idDimension: cat.tec.id,
        nombre: 'Integración con IA',
        sugeridaDefault: 3,
        alcanceDefault: 'externo',
        origen: 'lit_2020_2025',
        subfactores: {
          create: [
            { texto: 'Permite usar modelos externos' },
            { texto: 'Analiza datos con varios proveedores' },
          ],
        },
      },
    });

    const fin = await medir();
    expect(fin).toMatchObject({ estado: 'completada', version: { numero: 3 } });
    // Two queries, one per subfactor of the new factor: the three old anchors are kept.
    expect(biblio.consultas).toHaveLength(consultasAntes + 2);
    expect(fin.anclas).toEqual([
      {
        idFactor: cat.usabilidad.id,
        nombre: 'Usabilidad',
        citas: 6,
        ns: 2,
        r: 3,
      },
      {
        idFactor: cat.documentacion.id,
        nombre: 'Documentación',
        citas: 4,
        ns: 2,
        r: 2,
      },
      {
        idFactor: cat.formacion.id,
        nombre: 'Formación',
        citas: 2,
        ns: 2,
        r: 1,
      },
      {
        idFactor: nuevo.id,
        nombre: 'Integración con IA',
        citas: 8,
        ns: 2,
        r: 4,
      },
    ]);
    // QUARTILE.INC over [1, 2, 3, 4]: q1 = 1.75, q2 = 2.5, q3 = 3.25.
    expect(fin.cortes).toEqual({ rq1: 1.75, rq2: 2.5, rq3: 3.25 });

    const versiones = await t.prisma.catalogoVersion.findMany({
      orderBy: { numero: 'asc' },
    });
    expect(versiones.map((v) => v.numero)).toEqual([1, 2, 3]);
    // The cuts of the previous versions never change (RF-17).
    expect(versiones[1]).toMatchObject({ rq1: 1.5, rq2: 2, rq3: 2.5 });

    const anclas = await t.prisma.medicionAncla.findMany({
      where: { idCatalogoVersion: versiones[2].id },
      orderBy: { idFactor: 'asc' },
    });
    expect(anclas.map((a) => [a.idFactor, a.citas, a.ns, a.r])).toEqual([
      [cat.usabilidad.id, 6, 2, 3],
      [cat.documentacion.id, 4, 2, 2],
      [cat.formacion.id, 2, 2, 1],
      [nuevo.id, 8, 2, 4],
    ]);
    // The inherited anchors keep the period of their own measurement.
    expect(
      anclas.every((a) => a.periodoDesde === 2020 && a.periodoHasta === 2025),
    ).toBe(true);
  });

  it('answers 400 when every active factor already has an anchor', async () => {
    await medir();
    const res = await t
      .http()
      .post('/api/catalogo/anclas/medir')
      .set(admin.auth)
      .expect(400);
    expect(res.body.message).toContain('factores nuevos por medir');
    // Nothing new is published and the last anchors stay untouched.
    expect(await t.prisma.catalogoVersion.count()).toBe(2);
    expect(await t.prisma.medicionAncla.count()).toBe(3);
  });

  it('rejects a second measurement while one is running (RNF-12)', async () => {
    biblio.demora = 40;
    await t
      .http()
      .post('/api/catalogo/anclas/medir')
      .set(admin.auth)
      .expect(202);
    const segunda = await t
      .http()
      .post('/api/catalogo/anclas/medir')
      .set(admin.auth)
      .expect(409);
    expect(segunda.body.message).toContain('en curso');

    const fin = await esperarMedicion();
    expect(fin.estado).toBe('completada');
  });

  it('records the failure, publishes nothing and leaves the factors editable (RNF-06)', async () => {
    biblio.fallarEn = 'Documentación';
    const fin = await medir();
    expect(fin.estado).toBe('fallida');
    expect(fin.error).toContain('OpenAlex down');

    expect(await t.prisma.catalogoVersion.count()).toBe(1);
    expect(await t.prisma.medicionAncla.count()).toBe(0);
    expect(
      await t.prisma.estimacionIs.count({
        where: { estado: { in: ['en_curso', 'propuesta'] } },
      }),
    ).toBe(0);

    // The administrator can retry once the service is back.
    biblio.fallarEn = null;
    const reintento = await medir();
    expect(reintento).toMatchObject({
      estado: 'completada',
      version: { numero: 2 },
    });
  });

  it('answers 409 when the AI is not configured (RNF-06)', async () => {
    const sinIa = await createTestContext((b) =>
      b.overrideProvider(BIBLIOGRAFIA).useValue(biblio),
    );
    try {
      const otroAdmin = await sinIa.usuario('administrador');
      const res = await sinIa
        .http()
        .post('/api/catalogo/anclas/medir')
        .set(otroAdmin.auth)
        .expect(409);
      expect(res.body.message).toContain('IA');
    } finally {
      await sinIa.app.close();
    }
  });

  it('answers 400 when there are no active factors to measure', async () => {
    await t.reset();
    const otroAdmin = await t.usuario('administrador');
    const res = await t
      .http()
      .post('/api/catalogo/anclas/medir')
      .set(otroAdmin.auth)
      .expect(400);
    expect(res.body.message).toContain('factores activos');
  });
});
