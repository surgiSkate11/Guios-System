import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cuartilesInclusivos } from '@guios/calculo';
import { cargarCatalogo, type CatalogoJson } from './cargar-catalogo';

/** prisma/catalogo.json is the single source of truth of the thesis catalog (Table 7). */
const JSON_URL = join(__dirname, '..', '..', 'prisma', 'catalogo.json');
const catalogo = (): CatalogoJson =>
  JSON.parse(readFileSync(JSON_URL, 'utf8')) as CatalogoJson;

interface FilaVersion {
  id: number;
  numero: number;
  motivo: string;
  rq1: number;
  rq2: number;
  rq3: number;
}

interface AnclaCreada {
  idFactor: number;
  idCatalogoVersion: number;
  citas: number;
  ns: number;
  r: number;
  periodoDesde: number;
  periodoHasta: number;
  terminosBusqueda: unknown;
}

interface FactorCreado {
  id: number;
  idDimension: number;
  nombre: string;
  subfactores: string[];
}

/** In-memory double of the Prisma client, enough for the writes of cargarCatalogo. */
function prismaFalso(versionExistente?: FilaVersion) {
  const versiones: FilaVersion[] = versionExistente ? [versionExistente] : [];
  const factores: FactorCreado[] = [];
  const anclas: AnclaCreada[] = [];
  let secuencia = versionExistente?.id ?? 0;
  const tx = {
    catalogoVersion: {
      create: ({ data }: { data: Omit<FilaVersion, 'id'> }) => {
        const fila: FilaVersion = { id: ++secuencia, ...data };
        versiones.push(fila);
        return Promise.resolve(fila);
      },
    },
    dimension: {
      create: ({ data }: { data: { nombre: string } }) =>
        Promise.resolve({ id: ++secuencia, ...data }),
    },
    factor: {
      create: ({
        data,
      }: {
        data: {
          idDimension: number;
          nombre: string;
          subfactores: { create: { texto: string }[] };
        };
      }) => {
        const fila: FactorCreado = {
          id: ++secuencia,
          idDimension: data.idDimension,
          nombre: data.nombre,
          subfactores: data.subfactores.create.map((s) => s.texto),
        };
        factores.push(fila);
        return Promise.resolve(fila);
      },
    },
    medicionAncla: {
      create: ({ data }: { data: AnclaCreada }) => {
        anclas.push(data);
        return Promise.resolve(data);
      },
    },
  };
  const prisma = {
    catalogoVersion: {
      findFirst: () => Promise.resolve(versiones.at(-1) ?? null),
    },
    $transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> =>
      cb(tx),
  };
  return {
    prisma: prisma as unknown as Parameters<typeof cargarCatalogo>[0],
    versiones,
    factores,
    anclas,
  };
}

const redondear = (valor: number): number => Math.round(valor * 100) / 100;

describe('cargarCatalogo (thesis catalog with anchors)', () => {
  it('publishes version 1 with the 18 anchors of Table 7, TC 243 and NS 61', async () => {
    const { prisma, versiones, factores, anclas } = prismaFalso();
    const resumen = await cargarCatalogo(prisma, catalogo());

    expect(resumen).toMatchObject({ creado: true, version: 1, anclas: 18 });
    expect(resumen.dimensiones).toBe(3);
    expect(resumen.factores).toBe(18);
    expect(resumen.subfactores).toBe(
      factores.reduce((total, f) => total + f.subfactores.length, 0),
    );
    expect(anclas.reduce((total, a) => total + a.citas, 0)).toBe(243);
    expect(anclas.reduce((total, a) => total + a.ns, 0)).toBe(61);
    expect(versiones).toHaveLength(1);
  });

  it('derives r as TC / NS and keeps the 2008-2019 thesis period', async () => {
    const { prisma, anclas } = prismaFalso();
    await cargarCatalogo(prisma, catalogo());

    expect(anclas).toHaveLength(18);
    for (const ancla of anclas) {
      expect(ancla.r).toBe(ancla.citas / ancla.ns);
      expect(ancla.periodoDesde).toBe(2008);
      expect(ancla.periodoHasta).toBe(2019);
      // The anchors were not typed: their search terms are published later by "Medir anclas".
      expect(ancla.terminosBusqueda).toEqual({});
    }
  });

  it('seeds the inclusive-quartile cuts rounded to two decimals', async () => {
    const { prisma, versiones, anclas } = prismaFalso();
    await cargarCatalogo(prisma, catalogo());

    const cortes = cuartilesInclusivos(anclas.map((a) => a.r));
    expect({
      rq1: redondear(cortes.rq1),
      rq2: redondear(cortes.rq2),
      rq3: redondear(cortes.rq3),
    }).toEqual({ rq1: 1.86, rq2: 3.65, rq3: 4.78 });
    expect(versiones[0]).toMatchObject({
      numero: 1,
      rq1: 1.86,
      rq2: 3.65,
      rq3: 4.78,
    });
  });

  it('writes nothing when a catalog version already exists (idempotent)', async () => {
    const existente: FilaVersion = {
      id: 7,
      numero: 4,
      motivo: 'IS aprobada para un factor',
      rq1: 1,
      rq2: 2,
      rq3: 3,
    };
    const { prisma, versiones, factores, anclas } = prismaFalso(existente);
    const resumen = await cargarCatalogo(prisma, catalogo());

    expect(resumen).toEqual({
      creado: false,
      version: 4,
      dimensiones: 0,
      factores: 0,
      subfactores: 0,
      anclas: 0,
    });
    expect(versiones).toEqual([existente]);
    expect(factores).toEqual([]);
    expect(anclas).toEqual([]);
  });

  it('rejects an anchor without its period before writing anything', async () => {
    const json = catalogo();
    delete json.periodoAnclas;
    const { prisma, versiones, anclas } = prismaFalso();

    await expect(cargarCatalogo(prisma, json)).rejects.toThrow('periodoAnclas');
    expect(versiones).toEqual([]);
    expect(anclas).toEqual([]);
  });

  it('rejects an anchor whose NS is not a positive integer', async () => {
    const json = catalogo();
    json.dimensiones[0].factores[0].ancla = { ns: 0, citas: 3 };
    const { prisma, anclas } = prismaFalso();

    await expect(cargarCatalogo(prisma, json)).rejects.toThrow('ancla.ns');
    expect(anclas).toEqual([]);
  });
});
