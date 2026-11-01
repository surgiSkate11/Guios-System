import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  consolidarImportanciaDecisor,
  esRelevante,
  importanciaRelativa,
  type Importancia,
} from '@guios/calculo';
import type { UsuarioPublico } from '../auth/usuario-publico';
import type { Alcance, MetodoConsolidacion } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../proyectos/acceso.service';
import { consolidacionConfirmada, participantes } from './participantes';

export interface FactorConsolidado {
  idProyectoFactor: number;
  factor: { id: number; nombre: string };
  dimension: { id: number; nombre: string };
  impSugerida: number;
  importancias: { idUsuario: number; nombre: string; impDecisor: number }[];
  faltantes: number;
  idConsolidada: number | null;
  ir: number | null;
  esRelevante: boolean | null;
  alcanceDefault: Alcance;
  alcanceEfectivo: Alcance;
  justificacionAlcance: string | null;
}

export interface Consolidacion {
  confirmada: boolean;
  metodo: MetodoConsolidacion;
  factores: FactorConsolidado[];
}

/** Consolidated decision-maker importance, IR and relevance (RF-05 to RF-07). */
@Injectable()
export class ConsolidacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  async obtener(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<Consolidacion> {
    await this.acceso.comoCoordinador(idProyecto, usuario);
    return this.calcular(idProyecto);
  }

  async confirmar(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<Consolidacion> {
    const acceso = await this.acceso.comoCoordinador(idProyecto, usuario);
    this.acceso.exigirEnCurso(acceso);
    const vista = await this.calcular(idProyecto);
    if (vista.confirmada)
      throw new ConflictException('La consolidación ya fue confirmada');
    const faltantes = vista.factores.reduce((suma, f) => suma + f.faltantes, 0);
    if (faltantes > 0) {
      throw new ConflictException(
        `Faltan ${faltantes} importancias por registrar`,
      );
    }
    await this.prisma.$transaction(
      vista.factores.map((f) =>
        this.prisma.proyectoFactor.update({
          where: { id: f.idProyectoFactor },
          data: {
            impDecisorConsol: f.idConsolidada,
            impRelativa: f.ir,
            esRelevante: f.esRelevante,
          },
        }),
      ),
    );
    return this.calcular(idProyecto);
  }

  async cambiarAlcance(
    idProyecto: number,
    idProyectoFactor: number,
    usuario: UsuarioPublico,
    alcance: Alcance,
    justificacion?: string,
  ): Promise<FactorConsolidado> {
    const acceso = await this.acceso.comoCoordinador(idProyecto, usuario);
    this.acceso.exigirAbierto(acceso);
    const fila = await this.prisma.proyectoFactor.findFirst({
      where: { id: idProyectoFactor, idProyecto },
      include: { factor: true },
    });
    if (!fila)
      throw new NotFoundException('Factor no encontrado en el proyecto');
    const cambia = alcance !== fila.factor.alcanceDefault;
    const texto = justificacion?.trim();
    if (cambia && !texto) {
      throw new BadRequestException('Justifica el cambio de alcance');
    }
    await this.prisma.proyectoFactor.update({
      where: { id: idProyectoFactor },
      data: {
        alcanceEfectivo: alcance,
        justificacionAlcance: cambia ? texto : null,
      },
    });
    const vista = await this.calcular(idProyecto);
    return vista.factores.find((f) => f.idProyectoFactor === idProyectoFactor)!;
  }

  /** Live preview until confirmed; afterwards the stored values. */
  async calcular(idProyecto: number): Promise<Consolidacion> {
    const proyecto = await this.prisma.proyectoEvaluacion.findUniqueOrThrow({
      where: { id: idProyecto },
      include: {
        factores: {
          orderBy: { id: 'asc' },
          include: {
            factor: { include: { dimension: true } },
            importancias: {
              include: { usuario: { select: { nombre: true } } },
            },
          },
        },
      },
    });
    const jurados = await participantes(this.prisma, idProyecto);
    const confirmada = await consolidacionConfirmada(this.prisma, idProyecto);

    const factores = proyecto.factores.map((pf): FactorConsolidado => {
      const asignados = jurados.filter((j) =>
        j.idDimensiones.includes(pf.factor.idDimension),
      );
      const importancias = pf.importancias
        .filter((i) => asignados.some((j) => j.idUsuario === i.idUsuario))
        .map((i) => ({
          idUsuario: i.idUsuario,
          nombre: i.usuario.nombre,
          impDecisor: i.impDecisor,
        }));
      // A factor nobody judges cannot be consolidated: it counts as one missing answer.
      const faltantes =
        asignados.length === 0 ? 1 : asignados.length - importancias.length;

      let idConsolidada: number | null = pf.impDecisorConsol;
      let ir: number | null = pf.impRelativa;
      let relevante: boolean | null = pf.esRelevante;
      if (!confirmada) {
        idConsolidada = ir = relevante = null;
        if (faltantes === 0) {
          const id = consolidarImportanciaDecisor(
            importancias.map((i) => i.impDecisor as Importancia),
            proyecto.metodoConsolidacion,
          );
          const valorIr = importanciaRelativa(
            pf.impSugerida as Importancia,
            id,
          );
          idConsolidada = id;
          ir = valorIr;
          relevante = esRelevante(valorIr);
        }
      }
      return {
        idProyectoFactor: pf.id,
        factor: { id: pf.factor.id, nombre: pf.factor.nombre },
        dimension: {
          id: pf.factor.dimension.id,
          nombre: pf.factor.dimension.nombre,
        },
        impSugerida: pf.impSugerida,
        importancias,
        faltantes: confirmada ? 0 : faltantes,
        idConsolidada,
        ir,
        esRelevante: relevante,
        alcanceDefault: pf.factor.alcanceDefault,
        alcanceEfectivo: pf.alcanceEfectivo,
        justificacionAlcance: pf.justificacionAlcance,
      };
    });
    return { confirmada, metodo: proyecto.metodoConsolidacion, factores };
  }
}
