import type { PrismaClient } from '../src/generated/prisma/client';

/** Synthetic catalog: 2 dimensions, 3 factors, 2 subfactors each (one inactive factor). */
export async function seedCatalogo(prisma: PrismaClient) {
  const version = await prisma.catalogoVersion.create({
    data: {
      numero: 1,
      motivo: 'Catálogo de prueba',
      rq1: 1.86,
      rq2: 3.65,
      rq3: 4.78,
    },
  });
  const tec = await prisma.dimension.create({
    data: { nombre: 'Tecnológica' },
  });
  const org = await prisma.dimension.create({
    data: { nombre: 'Organizacional' },
  });

  async function factor(
    idDimension: number,
    nombre: string,
    sugeridaDefault: number,
    alcanceDefault: 'interno' | 'externo',
    activo = true,
  ) {
    return prisma.factor.create({
      data: {
        idDimension,
        nombre,
        sugeridaDefault,
        alcanceDefault,
        origen: 'tesis',
        activo,
        subfactores: {
          create: [{ texto: `${nombre} 1` }, { texto: `${nombre} 2` }],
        },
      },
      include: { subfactores: true },
    });
  }

  const usabilidad = await factor(tec.id, 'Usabilidad', 3, 'externo');
  const documentacion = await factor(tec.id, 'Documentación', 2, 'externo');
  const formacion = await factor(org.id, 'Formación', 3, 'interno');
  const retirado = await factor(tec.id, 'Retirado', 3, 'externo', false);

  return { version, tec, org, usabilidad, documentacion, formacion, retirado };
}

export async function crearOrganizacion(
  prisma: PrismaClient,
  nombre = 'NovaTech',
) {
  return prisma.organizacion.create({ data: { nombre, sector: 'privado' } });
}

type Catalogo = Awaited<ReturnType<typeof seedCatalogo>>;

/**
 * Project "en_curso" in the "Tecnológica" dimension (Usabilidad IS 3, Documentación IS 2)
 * with two software and the given active judges.
 */
export async function crearProyectoEnCurso(
  prisma: PrismaClient,
  cat: Catalogo,
  idCoordinador: number,
  idOrganizacion: number,
  jurados: number[],
  metodoConsolidacion: 'mediana' | 'promedio' = 'mediana',
) {
  const proyecto = await prisma.proyectoEvaluacion.create({
    data: {
      nombre: 'Proyecto de prueba',
      fechaInicio: new Date('2026-10-01'),
      estado: 'en_curso',
      metodoConsolidacion,
      idOrganizacion,
      idCoordinador,
      idCatalogoVersion: cat.version.id,
      dimensiones: { create: [{ idDimension: cat.tec.id }] },
      softwares: {
        create: [{ nombre: 'Software A' }, { nombre: 'Software B' }],
      },
      factores: {
        create: [
          {
            idFactor: cat.usabilidad.id,
            impSugerida: 3,
            alcanceEfectivo: 'externo',
          },
          {
            idFactor: cat.documentacion.id,
            impSugerida: 2,
            alcanceEfectivo: 'externo',
          },
        ],
      },
      jurados: {
        create: jurados.map((idUsuario) => ({
          idUsuario,
          estado: 'activo' as const,
          dimensiones: { create: [{ idDimension: cat.tec.id }] },
        })),
      },
    },
    include: {
      softwares: { orderBy: { id: 'asc' } },
      factores: { orderBy: { idFactor: 'asc' } },
    },
  });
  const [usabilidad, documentacion] = proyecto.factores;
  return {
    id: proyecto.id,
    softwares: proyecto.softwares,
    pfUsabilidad: usabilidad.id,
    pfDocumentacion: documentacion.id,
  };
}
