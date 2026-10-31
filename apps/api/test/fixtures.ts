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
