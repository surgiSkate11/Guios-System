import type { PrismaClient } from '../generated/prisma/client';

/** Input format of the thesis catalog (prisma/catalogo.json). */
export interface CatalogoJson {
  motivo: string;
  /** Current IL cut points (RN-02). */
  cortes: { rq1: number; rq2: number; rq3: number };
  /** Period of the thesis reference measurements; required when a factor has an anchor. */
  periodoAnclas?: { desde: number; hasta: number };
  dimensiones: {
    nombre: string;
    factores: {
      nombre: string;
      /** IS from 1 to 4. */
      sugeridaDefault: number;
      alcanceDefault: 'interno' | 'externo';
      /**
       * Reference measurement of the factor published with version 1 (Table 7 of the
       * thesis). r is never written in the file: it is derived as TC / NS (RN-01).
       */
      ancla?: { ns: number; citas: number };
      subfactores: string[];
    }[];
  }[];
}

export interface ResumenCarga {
  creado: boolean;
  version: number;
  dimensiones: number;
  factores: number;
  subfactores: number;
  anclas: number;
}

const MAX_TEXTO_SUBFACTOR = 300;

function validar(json: CatalogoJson): void {
  const { rq1, rq2, rq3 } = json.cortes ?? {};
  if (![rq1, rq2, rq3].every(Number.isFinite) || !(rq1 <= rq2 && rq2 <= rq3)) {
    throw new Error('cortes must satisfy rq1 <= rq2 <= rq3');
  }
  if (!json.motivo?.trim()) throw new Error('motivo is required');
  if (!Array.isArray(json.dimensiones) || json.dimensiones.length === 0) {
    throw new Error('At least one dimension is required');
  }
  for (const d of json.dimensiones) {
    if (
      !d.nombre?.trim() ||
      !Array.isArray(d.factores) ||
      d.factores.length === 0
    ) {
      throw new Error(
        `Dimension "${d.nombre}" needs a name and at least one factor`,
      );
    }
    for (const f of d.factores) {
      const ctx = `Factor "${f.nombre}"`;
      if (!f.nombre?.trim()) throw new Error('Every factor needs a name');
      if (
        !Number.isInteger(f.sugeridaDefault) ||
        f.sugeridaDefault < 1 ||
        f.sugeridaDefault > 4
      ) {
        throw new Error(
          `${ctx}: sugeridaDefault must be an integer from 1 to 4`,
        );
      }
      if (f.alcanceDefault !== 'interno' && f.alcanceDefault !== 'externo') {
        throw new Error(`${ctx}: alcanceDefault must be interno or externo`);
      }
      if (f.ancla) {
        if (!Number.isInteger(f.ancla.ns) || f.ancla.ns <= 0) {
          throw new Error(`${ctx}: ancla.ns must be a positive integer`);
        }
        if (!Number.isInteger(f.ancla.citas) || f.ancla.citas < 0) {
          throw new Error(`${ctx}: ancla.citas must be a non-negative integer`);
        }
      }
      if (!Array.isArray(f.subfactores) || f.subfactores.length === 0) {
        throw new Error(`${ctx}: at least one subfactor is required`);
      }
      for (const s of f.subfactores) {
        if (
          typeof s !== 'string' ||
          !s.trim() ||
          s.length > MAX_TEXTO_SUBFACTOR
        ) {
          throw new Error(
            `${ctx}: subfactor texts must be 1-${MAX_TEXTO_SUBFACTOR} characters`,
          );
        }
      }
    }
  }
  const conAncla = json.dimensiones.some((d) =>
    d.factores.some((f) => Boolean(f.ancla)),
  );
  if (conAncla) {
    const { desde, hasta } = json.periodoAnclas ?? {};
    if (
      !Number.isInteger(desde) ||
      !Number.isInteger(hasta) ||
      (desde as number) > (hasta as number)
    ) {
      throw new Error(
        'periodoAnclas with an integer desde <= hasta is required when a factor has an anchor',
      );
    }
  }
}

/**
 * Loads the validated thesis catalog as version 1 (HU-21), including the anchors of Table 7.
 * Idempotent: when any catalog version exists, nothing is written. Everything is validated
 * before the first write and inserted in one transaction, so a bad file leaves the database
 * untouched. r is always derived as TC / NS (RN-01); it is never read from the file.
 */
export async function cargarCatalogo(
  prisma: PrismaClient,
  json: CatalogoJson,
): Promise<ResumenCarga> {
  validar(json);
  const existente = await prisma.catalogoVersion.findFirst({
    orderBy: { numero: 'desc' },
  });
  if (existente) {
    return {
      creado: false,
      version: existente.numero,
      dimensiones: 0,
      factores: 0,
      subfactores: 0,
      anclas: 0,
    };
  }

  let factores = 0;
  let subfactores = 0;
  let anclas = 0;
  const periodo = json.periodoAnclas;
  await prisma.$transaction(async (tx) => {
    const version = await tx.catalogoVersion.create({
      data: { numero: 1, motivo: json.motivo.trim(), ...json.cortes },
    });
    for (const d of json.dimensiones) {
      const dimension = await tx.dimension.create({
        data: { nombre: d.nombre.trim() },
      });
      for (const f of d.factores) {
        const factor = await tx.factor.create({
          data: {
            idDimension: dimension.id,
            nombre: f.nombre.trim(),
            sugeridaDefault: f.sugeridaDefault,
            alcanceDefault: f.alcanceDefault,
            origen: 'tesis',
            isOrigen: 'tesis',
            // The thesis catalog comes from the expert survey (IE = 3).
            validadoExpertos: true,
            subfactores: {
              create: f.subfactores.map((texto) => ({ texto: texto.trim() })),
            },
          },
        });
        factores += 1;
        subfactores += f.subfactores.length;
        if (f.ancla && periodo) {
          // Reference measurement already published in version 1 (section 6).
          await tx.medicionAncla.create({
            data: {
              idFactor: factor.id,
              idCatalogoVersion: version.id,
              terminosBusqueda: {},
              periodoDesde: periodo.desde,
              periodoHasta: periodo.hasta,
              citas: f.ancla.citas,
              ns: f.ancla.ns,
              r: f.ancla.citas / f.ancla.ns,
            },
          });
          anclas += 1;
        }
      }
    }
  });
  return {
    creado: true,
    version: 1,
    dimensiones: json.dimensiones.length,
    factores,
    subfactores,
    anclas,
  };
}
