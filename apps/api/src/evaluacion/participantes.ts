import type { PrismaService } from '../prisma/prisma.service';

export interface Participante {
  idUsuario: number;
  nombre: string;
  estado: 'activo' | 'finalizado';
  idDimensiones: number[];
}

/**
 * Judges whose answers count: active or finished. Invited judges have not accepted yet,
 * so they neither answer nor block the consolidation.
 */
export async function participantes(
  prisma: PrismaService,
  idProyecto: number,
): Promise<Participante[]> {
  const filas = await prisma.juradoProyecto.findMany({
    where: { idProyecto, estado: { in: ['activo', 'finalizado'] } },
    include: { usuario: { select: { nombre: true } }, dimensiones: true },
    orderBy: { id: 'asc' },
  });
  return filas.map((f) => ({
    idUsuario: f.idUsuario,
    nombre: f.usuario.nombre,
    estado: f.estado as 'activo' | 'finalizado',
    idDimensiones: f.dimensiones.map((d) => d.idDimension),
  }));
}

/** Whether the coordinator already confirmed the consolidation (relevance is stored). */
export async function consolidacionConfirmada(
  prisma: PrismaService,
  idProyecto: number,
): Promise<boolean> {
  const confirmados = await prisma.proyectoFactor.count({
    where: { idProyecto, esRelevante: { not: null } },
  });
  return confirmados > 0;
}
