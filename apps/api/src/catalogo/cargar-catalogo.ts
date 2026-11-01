import type { PrismaClient } from '../generated/prisma/client';

/** Input format of the thesis catalog (prisma/catalogo.json). */
export interface CatalogoJson {
  motivo: string;
  /** Current IL cut points (RN-02). */
  cortes: { rq1: number; rq2: number; rq3: number };
  dimensiones: {
    nombre: string;
    factores: {
      nombre: string;
      /** IS from 1 to 4. */
      sugeridaDefault: number;
      alcanceDefault: 'interno' | 'externo';
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
}

/**
 * Loads the validated thesis catalog as version 1 (HU-21). Idempotent: when any catalog
 * version exists, nothing is written. Everything is validated before the first write and
 * inserted in one transaction, so a bad file leaves the database untouched.
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
    };
  }

  let factores = 0;
  let subfactores = 0;
  await prisma.$transaction(async (tx) => {
    await tx.catalogoVersion.create({
      data: { numero: 1, motivo: json.motivo.trim(), ...json.cortes },
    });
    for (const d of json.dimensiones) {
      const dimension = await tx.dimension.create({
        data: { nombre: d.nombre.trim() },
      });
      for (const f of d.factores) {
        await tx.factor.create({
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
      }
    }
  });
  return {
    creado: true,
    version: 1,
    dimensiones: json.dimensiones.length,
    factores,
    subfactores,
  };
}
