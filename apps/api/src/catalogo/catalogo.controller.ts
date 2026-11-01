import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Catalog reading (any signed-in user). Editing and versioning belong to RF-18 / RF-24. */
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('vigente')
  async vigente() {
    const version = await this.prisma.catalogoVersion.findFirst({
      orderBy: { numero: 'desc' },
      select: {
        id: true,
        numero: true,
        fecha: true,
        motivo: true,
        rq1: true,
        rq2: true,
        rq3: true,
      },
    });
    if (!version) throw new NotFoundException('No hay un catálogo cargado');
    const dimensiones = await this.prisma.dimension.findMany({
      where: { idProyecto: null },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nombre: true,
        factores: {
          where: { activo: true },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            nombre: true,
            sugeridaDefault: true,
            alcanceDefault: true,
            origen: true,
            validadoExpertos: true,
            subfactores: {
              where: { activo: true },
              orderBy: { id: 'asc' },
              select: { id: true, texto: true },
            },
          },
        },
      },
    });
    return { version, dimensiones };
  }

  @Get('versiones')
  versiones() {
    return this.prisma.catalogoVersion.findMany({
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true, fecha: true, motivo: true },
    });
  }
}
