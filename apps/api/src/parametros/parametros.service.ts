import { Injectable } from '@nestjs/common';
import type { MetodoConsolidacion } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Parametros {
  umbralFoda: number;
  umbralDesacuerdo: number;
  umbralEmpateTecnico: number;
  umbralMetricaAlta: number;
  umbralFactorDiscutido: number;
  umbralDatosInciertos: number;
  metodoConsolidacion: MetodoConsolidacion;
}

const SELECT = {
  umbralFoda: true,
  umbralDesacuerdo: true,
  umbralEmpateTecnico: true,
  umbralMetricaAlta: true,
  umbralFactorDiscutido: true,
  umbralDatosInciertos: true,
  metodoConsolidacion: true,
} as const;

/** Global analysis thresholds (RN-09, RN-13): the parametro_analisis row without a project. */
@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<Parametros> {
    const fila = await this.prisma.parametroAnalisis.findFirst({
      where: { idProyecto: null },
      select: SELECT,
    });
    // Defaults live in the schema; creating the row materializes them.
    return (
      fila ?? this.prisma.parametroAnalisis.create({ data: {}, select: SELECT })
    );
  }

  async reemplazar(parametros: Parametros): Promise<Parametros> {
    const fila = await this.prisma.parametroAnalisis.findFirst({
      where: { idProyecto: null },
    });
    if (fila) {
      return this.prisma.parametroAnalisis.update({
        where: { id: fila.id },
        data: parametros,
        select: SELECT,
      });
    }
    return this.prisma.parametroAnalisis.create({
      data: parametros,
      select: SELECT,
    });
  }
}
