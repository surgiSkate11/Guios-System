import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  banderaDatosInciertos,
  banderaDesacuerdo,
  banderaEmpateTecnico,
  banderaFactorDiscutido,
  banderaMetricaAltaNivelBajo,
  banderaMetricaContraNivel,
  clasificarFoda,
  DESCONOZCO,
  metricaFinal,
  metricaJurado,
  nivelAdopcion,
  ponderacionMediaConsolidada,
  type Calificacion,
  type Foda,
  type Importancia,
  type NivelAdopcion,
} from '@guios/calculo';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { pmDe } from '../evaluacion/respuestas.service';
import {
  consolidacionConfirmada,
  participantes,
} from '../evaluacion/participantes';
import type { Alcance, Prisma } from '../generated/prisma/client';
import {
  ParametrosService,
  type Parametros,
} from '../parametros/parametros.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../proyectos/acceso.service';

type TipoBandera =
  | 'desacuerdo'
  | 'empate_tecnico'
  | 'metrica_contra_nivel'
  | 'metrica_alta_nivel_bajo'
  | 'factor_discutido'
  | 'datos_inciertos';

export interface Bandera {
  tipo: TipoBandera;
  mensaje: string;
  idSoftware?: number;
  idProyectoFactor?: number;
  idUsuario?: number;
}

export interface FactorResultado {
  idProyectoFactor: number;
  nombre: string;
  ir: number;
  alcance: Alcance;
  pmPorJurado: { idUsuario: number; pm: number | null }[];
  pmConsolidada: number | null;
  foda: Foda | null;
}

export interface SoftwareResultado {
  id: number;
  nombre: string;
  ranking: number;
  nivel: NivelAdopcion;
  metrica: {
    final: number;
    minimo: number;
    maximo: number;
    desviacion: number;
  };
  scoresJurado: { idUsuario: number; nombre: string; score: number | null }[];
  factores: FactorResultado[];
}

export interface ResultadoProyecto {
  generadoEn: string | null;
  softwares: SoftwareResultado[];
  banderas: Bandera[];
}

/** Persisted snapshot: the result plus the thresholds it was computed with. */
interface Foto extends ResultadoProyecto {
  parametros: Parametros;
}

const NO_CONFIRMADA = 'Primero se debe confirmar la consolidación';
const redondear = (n: number) => Math.round(n * 100) / 100;

/** Data of one project needed by every calculation, loaded once. */
type Datos = Awaited<ReturnType<ResultadosService['cargar']>>;

/** PM, SWOT, metrics, adoption level, flags and audit (RF-09 to RF-15, RF-20). */
@Injectable()
export class ResultadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly parametros: ParametrosService,
  ) {}

  async vistaPrevia(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<ResultadoProyecto> {
    await this.acceso.comoCoordinador(idProyecto, usuario);
    const { resultado } = await this.calcularCompleto(idProyecto);
    return resultado;
  }

  async generar(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<ResultadoProyecto> {
    const acceso = await this.acceso.comoCoordinador(idProyecto, usuario);
    this.acceso.exigirEnCurso(acceso);
    const { resultado, datos } = await this.calcularCompleto(idProyecto);
    const generado: ResultadoProyecto = {
      ...resultado,
      generadoEn: new Date().toISOString(),
    };
    const foto: Foto = { ...generado, parametros: datos.parametros };
    const idSoftwares = datos.softwares.map((s) => s.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.resultadoJuradoFactor.deleteMany({
        where: { idSoftware: { in: idSoftwares } },
      });
      await tx.resultadoFactorSoftware.deleteMany({
        where: { idSoftware: { in: idSoftwares } },
      });
      await tx.resultadoSoftware.deleteMany({
        where: { idSoftware: { in: idSoftwares } },
      });
      for (const sw of generado.softwares) {
        await tx.resultadoSoftware.create({
          data: {
            idSoftware: sw.id,
            scoreFinal: sw.metrica.final,
            scoreMinimo: sw.metrica.minimo,
            scoreMaximo: sw.metrica.maximo,
            desviacion: sw.metrica.desviacion,
            nivelAdopcion: sw.nivel,
            ranking: sw.ranking,
          },
        });
        for (const f of sw.factores) {
          const pf = datos.factores.find((x) => x.id === f.idProyectoFactor)!;
          await tx.resultadoFactorSoftware.create({
            data: {
              idSoftware: sw.id,
              idProyectoFactor: f.idProyectoFactor,
              pmConsolidada: f.pmConsolidada,
              foda: f.foda,
            },
          });
          await tx.resultadoJuradoFactor.createMany({
            data: f.pmPorJurado.map((j) => ({
              idSoftware: sw.id,
              idUsuario: j.idUsuario,
              idFactor: pf.idFactor,
              pmJurado: j.pm,
            })),
          });
        }
      }
      const ultima = await tx.informeEvaluacion.findFirst({
        where: { idProyecto },
        orderBy: { version: 'desc' },
      });
      await tx.informeEvaluacion.create({
        data: {
          idProyecto,
          version: (ultima?.version ?? 0) + 1,
          fotoCalificaciones: foto as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return generado;
  }

  async ultimo(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<ResultadoProyecto> {
    await this.acceso.obtener(idProyecto, usuario);
    const foto = await this.foto(idProyecto);
    return {
      generadoEn: foto.generadoEn,
      softwares: foto.softwares,
      banderas: foto.banderas,
    };
  }

  /** A judge's own scores and PM with their personal SWOT (screen steps 5 and 6). */
  async mio(idProyecto: number, usuario: UsuarioPublico) {
    const acceso = await this.acceso.obtener(idProyecto, usuario);
    if (!acceso.jurado)
      throw new NotFoundException('No eres jurado de este proyecto');
    const foto = await this.foto(idProyecto);
    return {
      softwares: foto.softwares.map((sw) => ({
        id: sw.id,
        nombre: sw.nombre,
        score:
          sw.scoresJurado.find((s) => s.idUsuario === usuario.id)?.score ??
          null,
        factores: sw.factores.map((f) => {
          const pm =
            f.pmPorJurado.find((j) => j.idUsuario === usuario.id)?.pm ?? null;
          return {
            idProyectoFactor: f.idProyectoFactor,
            nombre: f.nombre,
            pm,
            foda:
              pm === null
                ? null
                : clasificarFoda(f.alcance, pm, foto.parametros.umbralFoda),
          };
        }),
      })),
    };
  }

  async auditoria(idProyecto: number, usuario: UsuarioPublico) {
    await this.acceso.comoCoordinador(idProyecto, usuario);
    const datos = await this.cargar(idProyecto);
    const importancias = await this.prisma.juradoImportancia.findMany({
      where: { proyectoFactor: { idProyecto } },
    });
    const todos = await this.prisma.proyectoFactor.findMany({
      where: { idProyecto },
      include: { factor: true },
      orderBy: { id: 'asc' },
    });
    return {
      jurados: datos.jurados.map((j) => {
        const mias = datos.respuestas.filter(
          (r) => r.idUsuario === j.idUsuario,
        );
        const desconozco = mias.filter((r) => r.desconozco).length;
        return {
          idUsuario: j.idUsuario,
          nombre: j.nombre,
          estado: j.estado,
          importancias: todos
            .filter((pf) => j.idDimensiones.includes(pf.factor.idDimension))
            .map((pf) => ({
              idProyectoFactor: pf.id,
              factor: pf.factor.nombre,
              impDecisor:
                importancias.find(
                  (i) =>
                    i.idProyectoFactor === pf.id && i.idUsuario === j.idUsuario,
                )?.impDecisor ?? null,
            })),
          calificaciones: {
            total: mias.length,
            desconozco,
            porcentajeDesconozco:
              mias.length === 0
                ? 0
                : redondear((100 * desconozco) / mias.length),
          },
          scores: datos.softwares.map((sw) => ({
            idSoftware: sw.id,
            score: this.scoreJurado(datos, sw.id, j.idUsuario),
          })),
        };
      }),
    };
  }

  private async foto(idProyecto: number): Promise<Foto> {
    const informe = await this.prisma.informeEvaluacion.findFirst({
      where: { idProyecto },
      orderBy: { version: 'desc' },
    });
    if (!informe) throw new NotFoundException('Aún no hay resultados');
    return informe.fotoCalificaciones as unknown as Foto;
  }

  private async cargar(idProyecto: number) {
    const proyecto = await this.prisma.proyectoEvaluacion.findUniqueOrThrow({
      where: { id: idProyecto },
      include: {
        parametros: true,
        softwares: { orderBy: { id: 'asc' } },
        factores: {
          where: { esRelevante: true },
          orderBy: { id: 'asc' },
          include: {
            factor: {
              include: {
                subfactores: {
                  where: { activo: true },
                  orderBy: { id: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    const jurados = await participantes(this.prisma, idProyecto);
    const idSubfactores = proyecto.factores.flatMap((pf) =>
      pf.factor.subfactores.map((s) => s.id),
    );
    const respuestas = await this.prisma.evaluacionSubfactor.findMany({
      where: {
        idSubfactor: { in: idSubfactores },
        software: { idProyecto },
        idUsuario: { in: jurados.map((j) => j.idUsuario) },
      },
    });
    const parametros: Parametros = proyecto.parametros
      ? {
          umbralFoda: proyecto.parametros.umbralFoda,
          umbralDesacuerdo: proyecto.parametros.umbralDesacuerdo,
          umbralEmpateTecnico: proyecto.parametros.umbralEmpateTecnico,
          umbralMetricaAlta: proyecto.parametros.umbralMetricaAlta,
          umbralFactorDiscutido: proyecto.parametros.umbralFactorDiscutido,
          umbralDatosInciertos: proyecto.parametros.umbralDatosInciertos,
          metodoConsolidacion: proyecto.parametros.metodoConsolidacion,
        }
      : await this.parametros.obtener();
    return {
      metodo: proyecto.metodoConsolidacion,
      softwares: proyecto.softwares,
      factores: proyecto.factores,
      jurados,
      respuestas,
      parametros,
    };
  }

  /** Judges assigned to a factor's dimension. */
  private asignados(datos: Datos, pf: Datos['factores'][number]) {
    return datos.jurados.filter((j) =>
      j.idDimensiones.includes(pf.factor.idDimension),
    );
  }

  private respuestasDe(
    datos: Datos,
    idSoftware: number,
    idUsuario: number,
    pf: Datos['factores'][number],
  ) {
    const ids = pf.factor.subfactores.map((s) => s.id);
    return datos.respuestas.filter(
      (r) =>
        r.idSoftware === idSoftware &&
        r.idUsuario === idUsuario &&
        ids.includes(r.idSubfactor),
    );
  }

  /** RN-11 over the judge's assigned relevant factors with PM. */
  private scoreJurado(
    datos: Datos,
    idSoftware: number,
    idUsuario: number,
  ): number | null {
    const factores = datos.factores
      .filter((pf) =>
        this.asignados(datos, pf).some((j) => j.idUsuario === idUsuario),
      )
      .map((pf) => ({
        ir: pf.impRelativa as Importancia,
        pm: pmDe(this.respuestasDe(datos, idSoftware, idUsuario, pf)),
      }));
    return metricaJurado(factores);
  }

  private async calcularCompleto(idProyecto: number) {
    if (!(await consolidacionConfirmada(this.prisma, idProyecto))) {
      throw new ConflictException(NO_CONFIRMADA);
    }
    const datos = await this.cargar(idProyecto);

    // RF-13: every assigned judge answered every active subfactor of every relevant factor.
    let faltantes = 0;
    for (const sw of datos.softwares) {
      for (const pf of datos.factores) {
        const asignados = this.asignados(datos, pf);
        const completo =
          asignados.length > 0 &&
          asignados.every(
            (j) =>
              this.respuestasDe(datos, sw.id, j.idUsuario, pf).length ===
              pf.factor.subfactores.length,
          );
        if (!completo) faltantes += 1;
      }
    }
    if (faltantes > 0) {
      throw new HttpException(
        {
          statusCode: 409,
          message: `Faltan ${faltantes} factores relevantes por evaluar`,
          faltantes,
        },
        HttpStatus.CONFLICT,
      );
    }

    const { parametros } = datos;
    const softwares = datos.softwares.map((sw) => {
      const factores: FactorResultado[] = datos.factores.map((pf) => {
        const pmPorJurado = this.asignados(datos, pf).map((j) => ({
          idUsuario: j.idUsuario,
          pm: pmDe(this.respuestasDe(datos, sw.id, j.idUsuario, pf)),
        }));
        const pmConsolidada = ponderacionMediaConsolidada(
          pmPorJurado.map((j) => j.pm),
        );
        return {
          idProyectoFactor: pf.id,
          nombre: pf.factor.nombre,
          ir: pf.impRelativa!,
          alcance: pf.alcanceEfectivo,
          pmPorJurado,
          pmConsolidada,
          foda:
            pmConsolidada === null
              ? null
              : clasificarFoda(
                  pf.alcanceEfectivo,
                  pmConsolidada,
                  parametros.umbralFoda,
                ),
        };
      });
      const clasificados = factores
        .filter((f) => f.foda !== null)
        .map((f) => ({ ir: f.ir as Importancia, foda: f.foda! }));
      const scoresJurado = datos.jurados.map((j) => ({
        idUsuario: j.idUsuario,
        nombre: j.nombre,
        score: this.scoreJurado(datos, sw.id, j.idUsuario),
      }));
      const metrica = metricaFinal(
        scoresJurado.map((s) => s.score),
        datos.metodo,
      );
      if (clasificados.length === 0 || metrica === null) {
        throw new ConflictException(
          `Ningún factor relevante de ${sw.nombre} tiene calificaciones distintas de Desconozco`,
        );
      }
      return {
        id: sw.id,
        nombre: sw.nombre,
        ranking: 0,
        nivel: nivelAdopcion(clasificados),
        metrica,
        scoresJurado,
        factores,
      };
    });

    [...softwares]
      .sort((a, b) => b.metrica.final - a.metrica.final || a.id - b.id)
      .forEach((sw, i) => (sw.ranking = i + 1));

    const resultado: ResultadoProyecto = {
      generadoEn: null,
      softwares,
      banderas: this.banderas(datos, softwares),
    };
    return { resultado, datos };
  }

  /** RN-13 flags with the project's thresholds. */
  private banderas(datos: Datos, softwares: SoftwareResultado[]): Bandera[] {
    const u = datos.parametros;
    const banderas: Bandera[] = [];
    const f2 = (n: number) => n.toFixed(2);

    for (const sw of softwares) {
      if (
        banderaDesacuerdo(
          sw.scoresJurado.map((s) => s.score),
          u.umbralDesacuerdo,
        )
      ) {
        banderas.push({
          tipo: 'desacuerdo',
          idSoftware: sw.id,
          mensaje: `Desacuerdo entre jurados en ${sw.nombre}: desviación ${f2(sw.metrica.desviacion)}`,
        });
      }
      if (
        banderaMetricaAltaNivelBajo(
          sw.metrica.final,
          sw.nivel,
          u.umbralMetricaAlta,
        )
      ) {
        banderas.push({
          tipo: 'metrica_alta_nivel_bajo',
          idSoftware: sw.id,
          mensaje: `${sw.nombre} tiene métrica alta (${f2(sw.metrica.final)}) con nivel C`,
        });
      }
      for (const f of sw.factores) {
        if (
          banderaFactorDiscutido(
            f.pmPorJurado.map((j) => j.pm),
            f.ir as Importancia,
            u.umbralFactorDiscutido,
          )
        ) {
          banderas.push({
            tipo: 'factor_discutido',
            idSoftware: sw.id,
            idProyectoFactor: f.idProyectoFactor,
            mensaje: `Factor discutido en ${sw.nombre}: ${f.nombre}`,
          });
        }
      }
    }
    for (let i = 0; i < softwares.length; i++) {
      for (let k = i + 1; k < softwares.length; k++) {
        const a = softwares[i];
        const b = softwares[k];
        if (
          banderaEmpateTecnico(
            a.metrica.final,
            b.metrica.final,
            u.umbralEmpateTecnico,
          )
        ) {
          banderas.push({
            tipo: 'empate_tecnico',
            idSoftware: a.id,
            mensaje: `Empate técnico entre ${a.nombre} y ${b.nombre}`,
          });
        }
        const ma = { metrica: a.metrica.final, nivel: a.nivel };
        const mb = { metrica: b.metrica.final, nivel: b.nivel };
        if (banderaMetricaContraNivel(ma, mb)) {
          banderas.push({
            tipo: 'metrica_contra_nivel',
            idSoftware: a.id,
            mensaje: `La mayor métrica entre ${a.nombre} y ${b.nombre} tiene peor nivel`,
          });
        }
      }
    }
    for (const j of datos.jurados) {
      const mias = datos.respuestas
        .filter((r) => r.idUsuario === j.idUsuario)
        .map((r): Calificacion =>
          r.desconozco ? DESCONOZCO : (r.valor as Calificacion),
        );
      if (
        mias.length > 0 &&
        banderaDatosInciertos(mias, u.umbralDatosInciertos)
      ) {
        banderas.push({
          tipo: 'datos_inciertos',
          idUsuario: j.idUsuario,
          mensaje: `Datos inciertos: ${j.nombre} respondió Desconozco en más del ${u.umbralDatosInciertos} %`,
        });
      }
    }
    return banderas;
  }
}
