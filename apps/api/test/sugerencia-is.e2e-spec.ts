import {
  IA_CLIENTE,
  type IaCliente,
  type OpcionesIa,
} from '../src/ia/ia-cliente';
import {
  BIBLIOGRAFIA,
  type Articulo,
  type Bibliografia,
} from '../src/catalogo/bibliografia';
import { crearOrganizacion, seedCatalogo } from './fixtures';

/** Fake OpenAlex: two recent articles per query, or a failure. */
class FakeBibliografia implements Bibliografia {
  consultas: string[] = [];
  fallar = false;
  buscar(consulta: string): Promise<Articulo[]> {
    this.consultas.push(consulta);
    if (this.fallar) return Promise.reject(new Error('OpenAlex down'));
    return Promise.resolve([
      {
        doi: 'https://doi.org/10.1/a',
        titulo: `Study on ${consulta}`,
        anio: 2024,
        tipo: 'article',
        resumen: 'r',
      },
      {
        doi: 'https://doi.org/10.1/b',
        titulo: 'Another study',
        anio: 2019,
        tipo: 'article',
        resumen: 'r',
      },
    ]);
  }
}
const biblio = new FakeBibliografia();
import { createTestContext, TestContext } from './helpers';

interface FactorEntrada {
  id: number;
  nombre: string;
  isTesis: number;
}

/** Fake model: answers with the IS chosen per factor name, or with a fixed raw text. */
class FakeIa implements IaCliente {
  readonly modelo = 'fake-model';
  llamadas: {
    instrucciones: string;
    entrada: string;
    opciones?: OpcionesIa;
  }[] = [];
  isPorNombre: Record<string, unknown> = {};
  crudo: string | null = null;
  fallo: Error | null = null;
  /** Fails only the calls that ask for web search (e.g. free tier without grounding). */
  falloConWeb: Error | null = null;
  omitir: string | null = null;
  confianza: unknown = 0.8;

  completar(
    instrucciones: string,
    entrada: string,
    opciones?: OpcionesIa,
  ): Promise<string> {
    this.llamadas.push({ instrucciones, entrada, opciones });
    if (this.fallo) return Promise.reject(this.fallo);
    if (this.falloConWeb && opciones?.busquedaWeb)
      return Promise.reject(this.falloConWeb);
    if (this.crudo !== null) return Promise.resolve(this.crudo);
    const { factores } = JSON.parse(entrada) as { factores: FactorEntrada[] };
    return Promise.resolve(
      JSON.stringify({
        factores: factores
          .filter((f) => f.nombre !== this.omitir)
          .map((f) => ({
            id: f.id,
            is: this.isPorNombre[f.nombre] ?? f.isTesis,
            justificacion: `Evidencia para ${f.nombre}`,
            confianza: this.confianza,
          })),
      }),
    );
  }
}

describe('AI suggested importance per evaluation context (e2e, test database)', () => {
  let t: TestContext;
  const ia = new FakeIa();
  let cat: Awaited<ReturnType<typeof seedCatalogo>>;
  let coord: Awaited<ReturnType<TestContext['usuario']>>;

  beforeAll(async () => {
    t = await createTestContext((b) =>
      b
        .overrideProvider(IA_CLIENTE)
        .useValue(ia)
        .overrideProvider(BIBLIOGRAFIA)
        .useValue(biblio),
    );
  });
  beforeEach(async () => {
    await t.reset();
    Object.assign(ia, {
      llamadas: [],
      isPorNombre: {},
      crudo: null,
      fallo: null,
      falloConWeb: null,
      omitir: null,
      confianza: 0.8,
    });
    cat = await seedCatalogo(t.prisma);
    const org = await crearOrganizacion(t.prisma);
    coord = await t.usuario('coordinador', { idOrganizacion: org.id });
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  async function crear(tipoSoftware?: string) {
    const res = await t
      .http()
      .post('/api/proyectos')
      .set(coord.auth)
      .send({
        nombre: 'Proyecto',
        fechaInicio: '2026-11-01',
        metodoConsolidacion: 'mediana',
        idDimensiones: [cat.tec.id],
        softwares: [{ nombre: 'Odoo' }],
        ...(tipoSoftware === undefined ? {} : { tipoSoftware }),
      })
      .expect(201);
    return res.body as {
      id: number;
      tipoSoftware: string | null;
      sugerenciaIs: {
        id: number;
        origen: string;
        modelo: string | null;
        motivoRespaldo: string | null;
      } | null;
    };
  }

  async function isDelProyecto(idProyecto: number) {
    const filas = await t.prisma.proyectoFactor.findMany({
      where: { idProyecto },
      include: { factor: true },
    });
    return Object.fromEntries(
      filas.map((f) => [f.factor.nombre, f.impSugerida]),
    );
  }

  it('asks once for every factor, with web search and the context, and applies the AI IS', async () => {
    ia.isPorNombre = { Usabilidad: 4, Documentación: 1 };
    const p = await crear('ERP');

    expect(ia.llamadas).toHaveLength(1);
    expect(ia.llamadas[0].opciones).toEqual({ busquedaWeb: true });
    const entrada = JSON.parse(ia.llamadas[0].entrada) as {
      contexto: { tipoOrganizacion: string; tipoSoftware: string };
      factores: FactorEntrada[];
    };
    expect(entrada.contexto).toEqual({
      tipoOrganizacion: 'privado',
      tipoSoftware: 'ERP',
    });
    expect(entrada.factores.map((f) => [f.nombre, f.isTesis])).toEqual([
      ['Usabilidad', 3],
      ['Documentación', 2],
    ]);

    expect(await isDelProyecto(p.id)).toEqual({
      Usabilidad: 4,
      Documentación: 1,
    });
    expect(p).toMatchObject({
      tipoSoftware: 'ERP',
      sugerenciaIs: {
        origen: 'ia',
        modelo: 'fake-model',
        motivoRespaldo: null,
      },
    });
  });

  it('caps the AI IS at one level from the thesis IS', async () => {
    ia.isPorNombre = { Documentación: 4 };
    const p = await crear('ERP');
    expect(await isDelProyecto(p.id)).toEqual({
      Usabilidad: 3,
      Documentación: 3,
    });

    const res = await t
      .http()
      .get(`/api/proyectos/${p.id}/sugerencia-is`)
      .set(coord.auth)
      .expect(200);
    const doc = res.body.factores.find(
      (f: { nombre: string }) => f.nombre === 'Documentación',
    );
    expect(doc).toMatchObject({
      isBase: 2,
      isIa: 4,
      isFinal: 3,
      ajustado: true,
      justificacion: 'Evidencia para Documentación',
      confianza: 0.8,
    });
  });

  it('stores the full transaction for audit (prompt, model, answer and origin)', async () => {
    const p = await crear('LMS');
    const fila = await t.prisma.sugerenciaIs.findUniqueOrThrow({
      where: { id: p.sugerenciaIs!.id },
    });
    expect(fila.origen).toBe('ia');
    expect(fila.modelo).toBe('fake-model');
    expect(fila.prompt).toContain('LMS');
    expect(fila.prompt).toContain(ia.llamadas[0].instrucciones);
    expect(fila.respuesta).toContain('Evidencia para Usabilidad');
    expect(fila.creadoEn).toBeInstanceOf(Date);
  });

  it('reuses the stored answer for an identical context (cache)', async () => {
    const primero = await crear('ERP');
    const segundo = await crear(' erp ');
    expect(ia.llamadas).toHaveLength(1);
    expect(segundo.sugerenciaIs!.id).toBe(primero.sugerenciaIs!.id);

    await crear('LMS');
    expect(ia.llamadas).toHaveLength(2);
  });

  it.each([
    ['malformed JSON', { crudo: 'no es json' }],
    ['an IS out of 1-4', { isPorNombre: { Usabilidad: 5 } }],
    ['a non-integer IS', { isPorNombre: { Usabilidad: 2.5 } }],
    ['a missing factor', { omitir: 'Usabilidad' }],
    ['a confidence out of 0-1', { confianza: 1.5 }],
  ])('discards %s and falls back to the thesis IS', async (_caso, cambio) => {
    Object.assign(ia, cambio);
    const p = await crear('ERP');
    expect(await isDelProyecto(p.id)).toEqual({
      Usabilidad: 3,
      Documentación: 2,
    });
    expect(p.sugerenciaIs).toMatchObject({ origen: 'respaldo' });
    expect(p.sugerenciaIs!.motivoRespaldo).toContain('Respuesta inválida');
  });

  it('falls back when the AI fails and does not cache the failure', async () => {
    ia.fallo = new Error('AI service answered 429');
    const p = await crear('ERP');
    expect(await isDelProyecto(p.id)).toEqual({
      Usabilidad: 3,
      Documentación: 2,
    });
    expect(p.sugerenciaIs).toMatchObject({
      origen: 'respaldo',
      motivoRespaldo: expect.stringContaining('429'),
    });

    ia.fallo = null;
    const otro = await crear('ERP');
    expect(otro.sugerenciaIs!.origen).toBe('ia');
    // A 429 is retried once without web search before falling back, then the new project calls again.
    expect(ia.llamadas).toHaveLength(3);
  });

  it('retries without web search when the plan rejects it, and records that', async () => {
    ia.falloConWeb = new Error('AI service answered 429');
    ia.isPorNombre = { Usabilidad: 4 };
    const p = await crear('ERP');
    expect(ia.llamadas.map((l) => l.opciones)).toEqual([
      { busquedaWeb: true },
      { busquedaWeb: false },
    ]);
    expect(p.sugerenciaIs).toMatchObject({ origen: 'ia' });
    expect(await isDelProyecto(p.id)).toEqual({
      Usabilidad: 4,
      Documentación: 2,
    });
    const res = await t
      .http()
      .get(`/api/proyectos/${p.id}/sugerencia-is`)
      .set(coord.auth)
      .expect(200);
    expect(res.body.contexto.busquedaWeb).toBe(false);
  });

  it('gives the AI recent internet evidence from OpenAlex for every factor', async () => {
    biblio.consultas = [];
    biblio.fallar = false;
    const p = await crear('ERP');
    expect(biblio.consultas).toEqual([
      'Usabilidad ERP software adoption',
      'Documentación ERP software adoption',
    ]);
    const entrada = JSON.parse(ia.llamadas[0].entrada) as {
      factores: {
        nombre: string;
        articulosRecientes: { titulo: string; anio: number; doi: string }[];
      }[];
    };
    // Only 2020-2025 articles count as recent evidence.
    expect(entrada.factores[0].articulosRecientes).toEqual([
      {
        titulo: 'Study on Usabilidad ERP software adoption',
        anio: 2024,
        doi: '10.1/a',
      },
    ]);
    const res = await t
      .http()
      .get(`/api/proyectos/${p.id}/sugerencia-is`)
      .set(coord.auth)
      .expect(200);
    expect(res.body.contexto.articulosWeb).toBe(2);
  });

  it('still asks the AI when OpenAlex is down', async () => {
    biblio.fallar = true;
    const p = await crear('ERP');
    biblio.fallar = false;
    expect(p.sugerenciaIs!.origen).toBe('ia');
    const res = await t
      .http()
      .get(`/api/proyectos/${p.id}/sugerencia-is`)
      .set(coord.auth)
      .expect(200);
    expect(res.body.contexto.articulosWeb).toBe(0);
  });

  it('accepts a project without software type and answers 404 to outsiders', async () => {
    const p = await crear();
    expect(p.tipoSoftware).toBeNull();
    const ajeno = await t.usuario('coordinador', {
      idOrganizacion: (await crearOrganizacion(t.prisma, 'Otra')).id,
    });
    await t
      .http()
      .get(`/api/proyectos/${p.id}/sugerencia-is`)
      .set(ajeno.auth)
      .expect(404);
  });
});
