import type { PrismaClient } from '../src/generated/prisma/client';

/**
 * Calibrated dataset for the HU-06 acceptance test (the results side of a tender).
 *
 * Section 4.8 of the specification illustrates metrics such as 72.3 and 70.0, but
 * those are mock-up figures. A judge's score is 100 * sum(IR * (PM - 1) / 3) / D
 * with integer ratings 1..4, so 72.3 (one decimal) is not representable for any
 * realistic denominator. This dataset uses exact values instead, computed by hand,
 * that still exercise every rule of RN-09..RN-12:
 *
 * - three factors with IR 3, 3 and 2 (so D = 8) and their importance between
 *   categories taken from the catalog suggestion;
 * - four judges, an even number, so the median has to average two scores;
 * - three software products reaching the three adoption levels C, B and A;
 * - a ranking that changes when the tender consolidates with the mean instead of
 *   the median, which is exactly what HU-06 asks to prove.
 *
 * How the expected numbers were obtained (no code involved):
 *   judge score = 100 * sum(IR * (PM - 1) / 3) / 8, with IR = [3, 3, 2].
 *   Software A judges' PM: 2, 2.5, 2, 3.5 | 3, 3, 3.5, 3 | 4, 3, 4, 3.5
 *     -> 62.5        (3 * 1/3 + 3 * 2/3 + 2 * 3/3 = 5)
 *     -> 60.416667   (3 * 1.5/3 + 3 * 2/3 + 2 * 2/3 = 4.833333)
 *     -> 68.75       (3 * 1/3 + 3 * 2.5/3 + 2 * 3/3 = 5.5)
 *     -> 77.083333   (3 * 2.5/3 + 3 * 2/3 + 2 * 2.5/3 = 6.166667)
 *     -> median (62.5 + 68.75) / 2 = 65.625; mean 67.1875; SD 6.484323
 *   Software B judges' PM: 3, 3.5, 3, 3 | 3, 3, 4, 3.5 | 2, 2.5, 2, 2.5
 *     -> 58.333333, 68.75, 70.833333, 68.75
 *     -> median 68.75; mean 66.666667; SD 4.885845
 *   Software C judges' PM: 4, 3.5, 4, 3.5 | 3.5, 4, 3.5, 4 | 3.5, 4, 3, 4
 *     -> 89.583333, 93.75, 85.416667, 93.75
 *     -> median 91.666667; mean 90.625; SD 3.454817
 *   SWOT: A has a threat on an external factor with IR 3 -> level C; B has a
 *   weakness on an internal factor with IR 2 -> level B; C has none -> level A.
 */

/** 1 irrelevant, 2 optional, 3 important, 4 fundamental. */
export type ImportanciaHu06 = 1 | 2 | 3 | 4;

export interface FactorHu06 {
  nombre: string;
  dimension: 'Tecnológica' | 'Organizacional';
  imp: ImportanciaHu06;
  alcance: 'interno' | 'externo';
}

/**
 * Decision-maker importance equals the catalog suggestion, so
 * IR = floor((IS + ID) / 2) = IS and no factor falls out of relevance.
 */
export const FACTORES_HU06: readonly FactorHu06[] = [
  {
    nombre: 'Usabilidad',
    dimension: 'Tecnológica',
    imp: 3,
    alcance: 'externo',
  },
  {
    nombre: 'Documentación',
    dimension: 'Tecnológica',
    imp: 3,
    alcance: 'externo',
  },
  {
    nombre: 'Formación',
    dimension: 'Organizacional',
    imp: 2,
    alcance: 'interno',
  },
];

/** Ratings of one software: [factor][judge][subfactor]. Each factor has 2 subfactors. */
export type RespuestasSoftware = readonly (readonly (readonly number[])[])[];

export const MATRIZ_HU06: Readonly<Record<string, RespuestasSoftware>> = {
  'Software A': [
    [
      [2, 2],
      [2, 3],
      [2, 2],
      [3, 4],
    ],
    [
      [3, 3],
      [3, 3],
      [3, 4],
      [3, 3],
    ],
    [
      [4, 4],
      [3, 3],
      [4, 4],
      [3, 4],
    ],
  ],
  'Software B': [
    [
      [3, 3],
      [3, 4],
      [3, 3],
      [3, 3],
    ],
    [
      [3, 3],
      [3, 3],
      [4, 4],
      [3, 4],
    ],
    [
      [2, 2],
      [2, 3],
      [2, 2],
      [2, 3],
    ],
  ],
  'Software C': [
    [
      [4, 4],
      [3, 4],
      [4, 4],
      [3, 4],
    ],
    [
      [3, 4],
      [4, 4],
      [3, 4],
      [4, 4],
    ],
    [
      [3, 4],
      [4, 4],
      [3, 3],
      [4, 4],
    ],
  ],
};

export interface MetricaEsperada {
  final: number;
  minimo: number;
  maximo: number;
  desviacion: number;
  ranking: number;
}

export interface SoftwareEsperado {
  nombre: string;
  pmConsolidada: readonly number[];
  foda: readonly string[];
  nivel: 'A' | 'B' | 'C';
  scores: readonly number[];
  mediana: MetricaEsperada;
  promedio: MetricaEsperada;
}

export const ESPERADO_HU06: readonly SoftwareEsperado[] = [
  {
    nombre: 'Software A',
    pmConsolidada: [2.25, 3, 3.75],
    foda: ['amenaza', 'oportunidad', 'fortaleza'],
    // An external factor with IR 3 below the SWOT threshold -> level C.
    nivel: 'C',
    scores: [62.5, 60.4167, 68.75, 77.0833],
    mediana: {
      final: 65.625,
      minimo: 60.4167,
      maximo: 77.0833,
      desviacion: 6.4843,
      ranking: 3,
    },
    promedio: {
      final: 67.1875,
      minimo: 60.4167,
      maximo: 77.0833,
      desviacion: 6.4843,
      ranking: 2,
    },
  },
  {
    nombre: 'Software B',
    pmConsolidada: [3, 3.25, 2.25],
    foda: ['oportunidad', 'oportunidad', 'debilidad'],
    // The failure is on an internal factor with IR 2 -> level B.
    nivel: 'B',
    scores: [58.3333, 68.75, 70.8333, 68.75],
    mediana: {
      final: 68.75,
      minimo: 58.3333,
      maximo: 70.8333,
      desviacion: 4.8858,
      ranking: 2,
    },
    promedio: {
      final: 66.6667,
      minimo: 58.3333,
      maximo: 70.8333,
      desviacion: 4.8858,
      ranking: 3,
    },
  },
  {
    nombre: 'Software C',
    pmConsolidada: [3.75, 3.75, 3.75],
    foda: ['oportunidad', 'oportunidad', 'fortaleza'],
    nivel: 'A',
    scores: [89.5833, 93.75, 85.4167, 93.75],
    mediana: {
      final: 91.6667,
      minimo: 85.4167,
      maximo: 93.75,
      desviacion: 3.4548,
      ranking: 1,
    },
    promedio: {
      final: 90.625,
      minimo: 85.4167,
      maximo: 93.75,
      desviacion: 3.4548,
      ranking: 1,
    },
  },
];

/**
 * With the mean, A (67.1875, level C) overtakes B (66.6667, level B): the two
 * metrics are less than 2 points apart and the higher one has the worse level.
 */
export const BANDERAS_PROMEDIO_HU06 = [
  'empate_tecnico',
  'metrica_contra_nivel',
] as const;

export type CatalogoHu06 = Awaited<ReturnType<typeof sembrarCatalogoHu06>>;

/** Catalog with the two dimensions and the three factors of the scenario. */
export async function sembrarCatalogoHu06(prisma: PrismaClient) {
  const version = await prisma.catalogoVersion.create({
    data: {
      numero: 1,
      motivo: 'Catálogo de aceptación HU-06',
      rq1: 1.86,
      rq2: 3.65,
      rq3: 4.78,
    },
  });
  const tecnologica = await prisma.dimension.create({
    data: { nombre: 'Tecnológica' },
  });
  const organizacional = await prisma.dimension.create({
    data: { nombre: 'Organizacional' },
  });
  const porNombre = {
    Tecnológica: tecnologica,
    Organizacional: organizacional,
  };

  const factores = [];
  for (const factor of FACTORES_HU06) {
    factores.push(
      await prisma.factor.create({
        data: {
          idDimension: porNombre[factor.dimension].id,
          nombre: factor.nombre,
          sugeridaDefault: factor.imp,
          alcanceDefault: factor.alcance,
          origen: 'tesis',
          activo: true,
          subfactores: {
            create: [
              { texto: `${factor.nombre} 1` },
              { texto: `${factor.nombre} 2` },
            ],
          },
        },
        include: { subfactores: { orderBy: { id: 'asc' } } },
      }),
    );
  }
  return {
    version,
    dimensiones: [tecnologica, organizacional],
    factores,
  };
}

export type ProyectoHu06 = Awaited<ReturnType<typeof crearProyectoHu06>>;

/** Tender with the number of software products and judges the test needs. */
export async function crearProyectoHu06(
  prisma: PrismaClient,
  cat: CatalogoHu06,
  opciones: {
    nombre: string;
    idCoordinador: number;
    idOrganizacion: number;
    jurados: readonly number[];
    softwares: readonly string[];
    metodo: 'mediana' | 'promedio';
  },
) {
  const proyecto = await prisma.proyectoEvaluacion.create({
    data: {
      nombre: opciones.nombre,
      fechaInicio: new Date('2026-10-01'),
      estado: 'en_curso',
      metodoConsolidacion: opciones.metodo,
      idOrganizacion: opciones.idOrganizacion,
      idCoordinador: opciones.idCoordinador,
      idCatalogoVersion: cat.version.id,
      dimensiones: {
        create: cat.dimensiones.map((d) => ({ idDimension: d.id })),
      },
      softwares: {
        create: opciones.softwares.map((nombre) => ({ nombre })),
      },
      factores: {
        create: cat.factores.map((factor, i) => ({
          idFactor: factor.id,
          impSugerida: FACTORES_HU06[i].imp,
          alcanceEfectivo: FACTORES_HU06[i].alcance,
        })),
      },
      jurados: {
        create: opciones.jurados.map((idUsuario) => ({
          idUsuario,
          estado: 'activo' as const,
          dimensiones: {
            create: cat.dimensiones.map((d) => ({ idDimension: d.id })),
          },
        })),
      },
    },
    include: {
      softwares: { orderBy: { id: 'asc' } },
      factores: { orderBy: { idFactor: 'asc' } },
    },
  });
  return {
    id: proyecto.id,
    softwares: proyecto.softwares,
    factores: proyecto.factores,
    subfactoresPorFactor: cat.factores.map((f) =>
      f.subfactores.map((s) => s.id),
    ),
  };
}

/**
 * Stores importances and ratings straight in the database. The reference scenario
 * goes through the REST API; the volume scenario uses this helper so the measured
 * time only covers the results endpoint (RNF-04).
 */
export async function cargarRespuestas(
  prisma: PrismaClient,
  proyecto: ProyectoHu06,
  idsJurados: readonly number[],
  matriz: readonly RespuestasSoftware[],
) {
  await prisma.juradoImportancia.createMany({
    data: proyecto.factores.flatMap((pf, i) =>
      idsJurados.map((idUsuario) => ({
        idProyectoFactor: pf.id,
        idUsuario,
        impDecisor: FACTORES_HU06[i].imp,
      })),
    ),
  });
  const filas: {
    idSoftware: number;
    idUsuario: number;
    idSubfactor: number;
    valor: number;
  }[] = [];
  for (const [s, software] of proyecto.softwares.entries()) {
    for (const [f, porJurado] of matriz[s].entries()) {
      const subfactores = proyecto.subfactoresPorFactor[f];
      for (const [j, valores] of porJurado.entries()) {
        for (const [k, valor] of valores.entries()) {
          filas.push({
            idSoftware: software.id,
            idUsuario: idsJurados[j],
            idSubfactor: subfactores[k],
            valor,
          });
        }
      }
    }
  }
  await prisma.evaluacionSubfactor.createMany({ data: filas });
}
