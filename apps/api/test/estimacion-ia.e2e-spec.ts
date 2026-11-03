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

/** Fake services: the AI classifies; it never returns numbers that the server trusts. */
class FakeBibliografia implements Bibliografia {
  fallar = false;
  consultas: string[] = [];
  buscar(consulta: string): Promise<Articulo[]> {
    this.consultas.push(consulta);
    if (this.fallar) return Promise.reject(new Error('OpenAlex down'));
    return Promise.resolve([
      art('10.1000/a1'),
      art('10.1000/a2'),
      art('10.1000/viejo', { anio: 2019 }),
      art('10.1000/norma', { tipo: 'standard' }),
      art('10.1000/inventada'),
    ]);
  }
}

class FakeIa implements IaCliente {
  readonly modelo = 'fake-model';
  entradas: string[] = [];
  completar(_instrucciones: string, entrada: string): Promise<string> {
    this.entradas.push(entrada);
    const candidatos = JSON.parse(entrada) as {
      candidatos: { i: number; doi: string }[];
    };
    return Promise.resolve(
      JSON.stringify(
        candidatos.candidatos.map((c) => ({
          i: c.i,
          respalda: true,
          // A fabricated quote must be discarded by the server (RNF-11).
          cita: c.doi.endsWith('inventada')
            ? 'a sentence that is not in the abstract'
            : 'intuitive interfaces reduce training time',
        })),
      ),
    );
  }
}

describe('AI-assisted IS estimation (e2e, test database)', () => {
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
    biblio.fallar = false;
    biblio.consultas.length = 0;
    ia.entradas.length = 0;
    cat = await seedCatalogo(t.prisma);
    admin = await t.usuario('administrador');
  });
  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  async function esperar(id: number) {
    for (let i = 0; i < 50; i++) {
      const res = await t
        .http()
        .get(`/api/catalogo/estimaciones/${id}`)
        .set(admin.auth)
        .expect(200);
      if (res.body.estado !== 'en_curso') return res.body;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('estimation did not finish');
  }

  it('counts only verified evidence and lets the code compute the IS (RF-23, RNF-11, RNF-13)', async () => {
    const inicio = await t
      .http()
      .post(`/api/catalogo/factores/${cat.usabilidad.id}/estimaciones`)
      .set(admin.auth)
      .expect(202);
    expect(inicio.body).toMatchObject({
      estado: 'en_curso',
      modo: 'ia',
      progreso: { hechos: 0, total: 2 },
    });

    const fin = await esperar(inicio.body.id);
    // 2 subfactors x 2 valid articles (2019, non-article and fabricated quote are discarded).
    expect(fin).toMatchObject({
      estado: 'propuesta',
      modo: 'ia',
      tc: 4,
      ns: 2,
      r: 2,
      progreso: null,
      error: null,
    });
    expect(fin.subfactores.map((s: { citas: number }) => s.citas)).toEqual([
      2, 2,
    ]);
    expect(fin.subfactores[0].dois).toEqual(['10.1000/a1', '10.1000/a2']);
    // IS computed by @guios/calculo with the seeded cut points (1.86, 3.65, 4.78): r 2 -> IL 2 -> IS 2.
    expect(fin).toMatchObject({ il: 2, isPropuesta: 2 });

    const fila = await t.prisma.estimacionIs.findUniqueOrThrow({
      where: { id: inicio.body.id },
    });
    expect(fila.modelo).toBe('fake-model');
    expect(JSON.stringify(fila.descartesJson)).toContain('10.1000/inventada');
    // RNF-13: only factor, subfactor texts and public abstracts leave the server.
    expect(biblio.consultas[0]).toContain('Usabilidad');
    expect(ia.entradas.join(' ')).not.toMatch(/@|password|jurado/i);
  });

  it('records the failure and keeps the manual form available when a service fails (RNF-06)', async () => {
    biblio.fallar = true;
    const inicio = await t
      .http()
      .post(`/api/catalogo/factores/${cat.usabilidad.id}/estimaciones`)
      .set(admin.auth)
      .expect(202);
    const fin = await esperar(inicio.body.id);
    expect(fin.estado).toBe('rechazada');
    expect(fin.error).toContain('OpenAlex down');
    await t
      .http()
      .post('/api/catalogo/factores')
      .set(admin.auth)
      .send({
        idDimension: cat.tec.id,
        nombre: 'Nuevo',
        alcanceDefault: 'externo',
        subfactores: [{ texto: 'S', citas: 1 }],
      })
      .expect(201);
  });

  it('answers 404 for an unknown factor', async () => {
    await t
      .http()
      .post('/api/catalogo/factores/999999/estimaciones')
      .set(admin.auth)
      .expect(404);
  });
});
