import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DESCONOZCO,
  ponderacionMediaJurado,
  type Calificacion,
} from '@guios/calculo';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccesoService,
  type AccesoProyecto,
} from '../proyectos/acceso.service';
import { consolidacionConfirmada } from './participantes';

const NO_CONFIRMADA = 'Primero se debe confirmar la consolidación';
const YA_CONFIRMADA = 'La consolidación ya fue confirmada';

interface FilaRespuesta {
  valor: number | null;
  desconozco: boolean;
}

/** RN-07 on the answered subfactors; null when nothing counts. */
export function pmDe(respuestas: FilaRespuesta[]): number | null {
  if (respuestas.length === 0) return null;
  return ponderacionMediaJurado(
    respuestas.map((r): Calificacion =>
      r.desconozco ? DESCONOZCO : (r.valor as Calificacion),
    ),
  );
}

/** Each judge's importances (RF-04) and subfactor ratings (RF-08), saved immediately. */
@Injectable()
export class RespuestasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  async misImportancias(idProyecto: number, usuario: UsuarioPublico) {
    const acceso = await this.acceso.comoJuradoActivo(idProyecto, usuario);
    const filas = await this.prisma.proyectoFactor.findMany({
      where: {
        idProyecto,
        factor: { idDimension: { in: acceso.jurado!.idDimensiones } },
      },
      include: {
        factor: { include: { dimension: true } },
        importancias: { where: { idUsuario: usuario.id } },
      },
      orderBy: { id: 'asc' },
    });
    return filas.map((pf) => ({
      idProyectoFactor: pf.id,
      factor: { id: pf.factor.id, nombre: pf.factor.nombre },
      dimension: {
        id: pf.factor.dimension.id,
        nombre: pf.factor.dimension.nombre,
      },
      impSugerida: pf.impSugerida,
      impDecisor: pf.importancias[0]?.impDecisor ?? null,
    }));
  }

  async guardarImportancia(
    idProyecto: number,
    idProyectoFactor: number,
    usuario: UsuarioPublico,
    impDecisor: number,
  ) {
    const acceso = await this.acceso.comoJuradoActivo(idProyecto, usuario);
    this.acceso.exigirEnCurso(acceso);
    await this.factorDelJurado(acceso, idProyectoFactor);
    if (await consolidacionConfirmada(this.prisma, idProyecto)) {
      throw new ConflictException(YA_CONFIRMADA);
    }
    await this.prisma.juradoImportancia.upsert({
      where: {
        idProyectoFactor_idUsuario: { idProyectoFactor, idUsuario: usuario.id },
      },
      create: { idProyectoFactor, idUsuario: usuario.id, impDecisor },
      update: { impDecisor },
    });
    return { idProyectoFactor, impDecisor };
  }

  async misCalificaciones(
    idProyecto: number,
    idSoftware: number,
    usuario: UsuarioPublico,
  ) {
    const acceso = await this.acceso.comoJuradoActivo(idProyecto, usuario);
    const software = await this.softwareDelProyecto(idProyecto, idSoftware);
    if (!(await consolidacionConfirmada(this.prisma, idProyecto))) {
      throw new ConflictException(NO_CONFIRMADA);
    }
    const filas = await this.prisma.proyectoFactor.findMany({
      where: {
        idProyecto,
        esRelevante: true,
        factor: { idDimension: { in: acceso.jurado!.idDimensiones } },
      },
      include: {
        factor: {
          include: {
            dimension: true,
            subfactores: {
              where: { activo: true },
              orderBy: { id: 'asc' },
              include: {
                calificaciones: {
                  where: { idUsuario: usuario.id, idSoftware },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    return {
      software: { id: software.id, nombre: software.nombre },
      factores: filas.map((pf) => {
        const subfactores = pf.factor.subfactores.map((s) => {
          const r = s.calificaciones[0];
          return {
            id: s.id,
            texto: s.texto,
            valor: r?.valor ?? null,
            desconozco: r?.desconozco ?? false,
            respondido: r !== undefined,
          };
        });
        return {
          idProyectoFactor: pf.id,
          factor: { id: pf.factor.id, nombre: pf.factor.nombre },
          dimension: {
            id: pf.factor.dimension.id,
            nombre: pf.factor.dimension.nombre,
          },
          ir: pf.impRelativa,
          pm: pmDe(subfactores.filter((s) => s.respondido)),
          subfactores,
        };
      }),
    };
  }

  async calificar(
    idProyecto: number,
    usuario: UsuarioPublico,
    dto: {
      idSoftware: number;
      idSubfactor: number;
      valor?: number;
      desconozco?: true;
    },
  ) {
    if (dto.valor !== undefined && dto.desconozco !== undefined) {
      throw new BadRequestException('Envía un valor o Desconozco, no ambos');
    }
    const acceso = await this.acceso.comoJuradoActivo(idProyecto, usuario);
    this.acceso.exigirEnCurso(acceso);
    if (!(await consolidacionConfirmada(this.prisma, idProyecto))) {
      throw new ConflictException(NO_CONFIRMADA);
    }
    await this.softwareDelProyecto(idProyecto, dto.idSoftware);
    const subfactor = await this.prisma.subfactor.findFirst({
      where: {
        id: dto.idSubfactor,
        activo: true,
        factor: {
          idDimension: { in: acceso.jurado!.idDimensiones },
          proyectos: { some: { idProyecto, esRelevante: true } },
        },
      },
      include: {
        factor: { include: { proyectos: { where: { idProyecto } } } },
      },
    });
    if (!subfactor)
      throw new NotFoundException('Subfactor no disponible para calificar');

    const desconozco = dto.desconozco === true;
    const valor = desconozco ? null : dto.valor!;
    const clave = {
      idSoftware: dto.idSoftware,
      idUsuario: usuario.id,
      idSubfactor: dto.idSubfactor,
    };
    await this.prisma.evaluacionSubfactor.upsert({
      where: { idSoftware_idUsuario_idSubfactor: clave },
      create: { ...clave, valor, desconozco },
      update: { valor, desconozco },
    });
    const respuestas = await this.prisma.evaluacionSubfactor.findMany({
      where: {
        idSoftware: dto.idSoftware,
        idUsuario: usuario.id,
        subfactor: { idFactor: subfactor.idFactor, activo: true },
      },
    });
    return {
      idProyectoFactor: subfactor.factor.proyectos[0].id,
      pm: pmDe(respuestas),
    };
  }

  private async factorDelJurado(
    acceso: AccesoProyecto,
    idProyectoFactor: number,
  ) {
    const pf = await this.prisma.proyectoFactor.findFirst({
      where: {
        id: idProyectoFactor,
        idProyecto: acceso.proyecto.id,
        factor: { idDimension: { in: acceso.jurado!.idDimensiones } },
      },
    });
    if (!pf) throw new NotFoundException('Factor no encontrado en el proyecto');
    return pf;
  }

  private async softwareDelProyecto(idProyecto: number, idSoftware: number) {
    const software = await this.prisma.softwareCandidato.findFirst({
      where: { id: idSoftware, idProyecto },
    });
    if (!software) throw new NotFoundException('Software no encontrado');
    return software;
  }
}
