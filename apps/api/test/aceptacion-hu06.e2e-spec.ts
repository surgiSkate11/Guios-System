import {
  BANDERAS_PROMEDIO_HU06,
  cargarRespuestas,
  crearProyectoHu06,
  ESPERADO_HU06,
  FACTORES_HU06,
  MATRIZ_HU06,
  sembrarCatalogoHu06,
  type ProyectoHu06,
  type RespuestasSoftware,
} from './datos-referencia-hu06';
import { crearOrganizacion } from './fixtures';
import { createTestContext, TestContext } from './helpers';

type Usuario = Awaited<ReturnType<TestContext['usuario']>>;

interface VistaSoftware {
  nombre: string;
  ranking: number;
  nivel: 'A' | 'B' | 'C';
  scoresJurado: { idUsuario: number; nombre: string; score: number | null }[];
  metrica: {
    final: number;
    minimo: number;
    maximo: number;
    desviacion: number;
  };
  factores: {
    ir: number;
    alcance: string;
    pmConsolidada: number | null;
    foda: string | null;
  }[];
}

interface Vista {
  generadoEn: string | null;
  softwares: VistaSoftware[];
  banderas: { tipo: string }[];
}

/**
 * HU-06 acceptance test with the calibrated dataset of `datos-referencia-hu06.ts`:
 * the numbers are checked against exact arithmetic, not against the service output.
 */
describe('HU-06 acceptance with a calibrated dataset (e2e, test database)', () => {
  let t: TestContext;
  let cat: Awaited<ReturnType<typeof sembrarCatalogoHu06>>;
  let coord: Usuario;
  let jurados: Usuario[];
  let mediana: ProyectoHu06;
  let promedio: ProyectoHu06;

  const url = (proyecto: ProyectoHu06, path: string) =>
    `/api/proyectos/${proyecto.id}${path}`;

  beforeAll(async () => {
    t = await createTestContext();
  });

  afterAll(async () => {
    await t.reset();
    await t.app.close();
  });

  beforeEach(async () => {
    await t.reset();
    cat = await sembrarCatalogoHu06(t.prisma);
    const org = await crearOrganizacion(
      t.prisma,
      'Universidad Estatal de Milagro',
    );
    coord = await t.usuario('coordinador', { idOrganizacion: org.id });
    jurados = [];
    for (let i = 0; i < 4; i += 1) {
      jurados.push(await t.usuario('invitado', { nombre: `Juez ${i + 1}` }));
    }
    const base = {
      idCoordinador: coord.id,
      idOrganizacion: org.id,
      jurados: jurados.map((j) => j.id),
      softwares: Object.keys(MATRIZ_HU06),
    };
    mediana = await crearProyectoHu06(t.prisma, cat, {
      ...base,
      nombre: 'Licitación consolidada por mediana',
      metodo: 'mediana',
    });
    promedio = await crearProyectoHu06(t.prisma, cat, {
      ...base,
      nombre: 'Licitación consolidada por promedio',
      metodo: 'promedio',
    });
    await responderPorApi(mediana);
    await responderPorApi(promedio);
  }, 120_000);

  /**
   * The real workflow: judges register their importances, the coordinator confirms
   * the consolidation and only then the judges rate (a rating before the confirmation
   * is a 409 by design).
   */
  async function responderPorApi(proyecto: ProyectoHu06) {
    for (const [f, pf] of proyecto.factores.entries()) {
      for (const jurado of jurados) {
        await t
          .http()
          .put(url(proyecto, `/importancias/${pf.id}`))
          .set(jurado.auth)
          .send({ impDecisor: FACTORES_HU06[f].imp })
          .expect(200);
      }
    }
    await t
      .http()
      .post(url(proyecto, '/consolidacion/confirmar'))
      .set(coord.auth)
      .expect(201);
    for (const software of proyecto.softwares) {
      const matriz = MATRIZ_HU06[software.nombre];
      for (const [f, porJurado] of matriz.entries()) {
        const subfactores = proyecto.subfactoresPorFactor[f];
        for (const [j, valores] of porJurado.entries()) {
          for (const [k, valor] of valores.entries()) {
            await t
              .http()
              .put(url(proyecto, '/calificaciones'))
              .set(jurados[j].auth)
              .send({
                idSoftware: software.id,
                idSubfactor: subfactores[k],
                valor,
              })
              .expect(200);
          }
        }
      }
    }
  }

  async function vistaPrevia(proyecto: ProyectoHu06, usuario = coord) {
    const res = await t
      .http()
      .get(url(proyecto, '/resultados/vista-previa'))
      .set(usuario.auth)
      .expect(200);
    return res.body as Vista;
  }

  const porNombre = (vista: Vista, nombre: string): VistaSoftware => {
    const software = vista.softwares.find((s) => s.nombre === nombre);
    expect(software).toBeDefined();
    return software!;
  };

  it('reproduces the calibrated scenario with the median method (HU-06)', async () => {
    const vista = await vistaPrevia(mediana);
    expect(vista.generadoEn).toBeNull();
    expect(vista.banderas).toEqual([]);
    expect(vista.softwares).toHaveLength(ESPERADO_HU06.length);

    for (const esperado of ESPERADO_HU06) {
      const sw = porNombre(vista, esperado.nombre);
      expect(sw.nivel).toBe(esperado.nivel);
      expect(sw.ranking).toBe(esperado.mediana.ranking);
      expect(sw.factores.map((f) => f.ir)).toEqual([3, 3, 2]);
      expect(sw.factores.map((f) => f.alcance)).toEqual([
        'externo',
        'externo',
        'interno',
      ]);
      expect(sw.factores.map((f) => f.pmConsolidada)).toEqual(
        esperado.pmConsolidada,
      );
      expect(sw.factores.map((f) => f.foda)).toEqual(esperado.foda);
      expect(sw.scoresJurado.map((s) => s.idUsuario)).toEqual(
        jurados.map((j) => j.id),
      );
      expect(sw.scoresJurado.map((s) => s.score)).toEqual(
        esperado.scores.map((valor) => expect.closeTo(valor, 2)),
      );
      expect(sw.metrica.final).toBeCloseTo(esperado.mediana.final, 3);
      expect(sw.metrica.minimo).toBeCloseTo(esperado.mediana.minimo, 3);
      expect(sw.metrica.maximo).toBeCloseTo(esperado.mediana.maximo, 3);
      expect(sw.metrica.desviacion).toBeCloseTo(esperado.mediana.desviacion, 3);
    }

    // Level C, B and A come out of the same tender, which is the point of RNF-04.
    expect(vista.softwares.map((s) => s.nivel).sort()).toEqual(['A', 'B', 'C']);
  });

  it('uses the mean when the tender configured it and reports the tie it causes', async () => {
    const conPromedio = await vistaPrevia(promedio);
    for (const esperado of ESPERADO_HU06) {
      const sw = porNombre(conPromedio, esperado.nombre);
      // The consolidation method only changes the final metric and the ranking.
      expect(sw.nivel).toBe(esperado.nivel);
      expect(sw.factores.map((f) => f.pmConsolidada)).toEqual(
        esperado.pmConsolidada,
      );
      expect(sw.ranking).toBe(esperado.promedio.ranking);
      expect(sw.metrica.final).toBeCloseTo(esperado.promedio.final, 3);
      expect(sw.metrica.desviacion).toBeCloseTo(
        esperado.promedio.desviacion,
        3,
      );
    }
    expect(conPromedio.banderas.map((b) => b.tipo)).toEqual([
      ...BANDERAS_PROMEDIO_HU06,
    ]);

    // Same answers, two tenders: A and B swap places because the method differs.
    const conMediana = await vistaPrevia(mediana);
    const orden = (vista: Vista) =>
      [...vista.softwares]
        .sort((a, b) => a.ranking - b.ranking)
        .map((s) => s.nombre);
    expect(orden(conMediana)).toEqual([
      'Software C',
      'Software B',
      'Software A',
    ]);
    expect(orden(conPromedio)).toEqual([
      'Software C',
      'Software A',
      'Software B',
    ]);
    const a = (vista: Vista) => porNombre(vista, 'Software A').metrica.final;
    expect(a(conMediana)).not.toBeCloseTo(a(conPromedio), 2);
  });

  it('answers for 5 software products and 10 judges in under 2 s (RNF-04)', async () => {
    const org = await crearOrganizacion(
      t.prisma,
      'Universidad Técnica del Norte',
    );
    const coordinador = await t.usuario('coordinador', {
      idOrganizacion: org.id,
    });
    const diez: Usuario[] = [];
    for (let i = 0; i < 10; i += 1) {
      diez.push(
        await t.usuario('invitado', { nombre: `Jurado volumen ${i + 1}` }),
      );
    }
    const ids = diez.map((j) => j.id);
    const nombres = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'].map(
      (n) => `Software ${n}`,
    );
    const grande = await crearProyectoHu06(t.prisma, cat, {
      nombre: 'Licitación con cinco productos',
      idCoordinador: coordinador.id,
      idOrganizacion: org.id,
      jurados: ids,
      softwares: nombres,
      metodo: 'mediana',
    });
    const matriz: RespuestasSoftware[] = nombres.map((_, s) =>
      FACTORES_HU06.map((_, f) =>
        diez.map((_, j) => {
          const base = 1 + ((s + f + j) % 4);
          return [base, base < 4 ? base + 1 : 4];
        }),
      ),
    );
    await cargarRespuestas(t.prisma, grande, ids, matriz);
    await t
      .http()
      .post(url(grande, '/consolidacion/confirmar'))
      .set(coordinador.auth)
      .expect(201);

    const inicio = Date.now();
    const vista = await vistaPrevia(grande, coordinador);
    const ms = Date.now() - inicio;

    expect(ms).toBeLessThan(2000);
    expect(vista.softwares).toHaveLength(5);
    expect(vista.softwares.every((s) => s.scoresJurado.length === 10)).toBe(
      true,
    );
    expect(vista.softwares.map((s) => s.ranking).sort((a, b) => a - b)).toEqual(
      [1, 2, 3, 4, 5],
    );
  }, 60_000);
});
