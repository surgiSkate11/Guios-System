import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Cortes } from '@guios/calculo';
import type { UsuarioPublico } from '../auth/usuario-publico';
import type {
  Alcance,
  EstadoEstimacionIs,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularIs,
  normalizarDoi,
  toEstimacion,
  type CitasSubfactor,
  type Estimacion,
  type Progreso,
} from './estimacion';

export interface FactorAdmin {
  id: number;
  nombre: string;
  idDimension: number;
  dimension: { id: number; nombre: string };
  sugeridaDefault: number;
  alcanceDefault: Alcance;
  origen: string;
  isOrigen: string;
  validadoExpertos: boolean;
  activo: boolean;
  subfactores: { id: number; texto: string; activo: boolean }[];
}

const INCLUDE_FACTOR = {
  dimension: { select: { id: true, nombre: true } },
  subfactores: {
    orderBy: { id: 'asc' },
    select: { id: true, texto: true, activo: true },
  },
} satisfies Prisma.FactorInclude;

type FactorCompleto = Prisma.FactorGetPayload<{
  include: typeof INCLUDE_FACTOR;
}>;

const toFactorAdmin = (f: FactorCompleto): FactorAdmin => ({
  id: f.id,
  nombre: f.nombre,
  idDimension: f.idDimension,
  dimension: f.dimension,
  sugeridaDefault: f.sugeridaDefault,
  alcanceDefault: f.alcanceDefault,
  origen: f.origen,
  isOrigen: f.isOrigen,
  validadoExpertos: f.validadoExpertos,
  activo: f.activo,
  subfactores: f.subfactores,
});

export interface NuevoFactor {
  idDimension: number;
  nombre: string;
  alcanceDefault: Alcance;
  subfactores: { texto: string; citas: number; dois?: string[] }[];
}

/**
 * Catalog administration (RF-18) and the IS of new factors (RF-22, RF-24). The IS is always
 * computed here with @guios/calculo; approving publishes a new catalog version so existing
 * projects keep theirs (HU-24).
 */
@Injectable()
export class CatalogoAdminService {
  /** Live progress of AI estimations running in this process (RNF-12). */
  readonly progresos = new Map<number, Progreso>();

  constructor(private readonly prisma: PrismaService) {}

  async cortesVigentes(): Promise<Cortes> {
    const version = await this.prisma.catalogoVersion.findFirst({
      orderBy: { numero: 'desc' },
    });
    if (!version) throw new ConflictException('No hay un catálogo cargado');
    return { rq1: version.rq1, rq2: version.rq2, rq3: version.rq3 };
  }

  async factores(): Promise<FactorAdmin[]> {
    const filas = await this.prisma.factor.findMany({
      where: { dimension: { idProyecto: null } },
      include: INCLUDE_FACTOR,
      orderBy: { id: 'asc' },
    });
    return filas.map(toFactorAdmin);
  }

  async actualizarFactor(
    id: number,
    dto: { nombre?: string; alcanceDefault?: Alcance; activo?: boolean },
  ): Promise<FactorAdmin> {
    await this.factorExistente(id);
    const fila = await this.prisma.factor.update({
      where: { id },
      data: dto,
      include: INCLUDE_FACTOR,
    });
    return toFactorAdmin(fila);
  }

  async agregarSubfactor(idFactor: number, texto: string) {
    await this.factorExistente(idFactor);
    return this.prisma.subfactor.create({
      data: { idFactor, texto },
      select: { id: true, texto: true, activo: true },
    });
  }

  async actualizarSubfactor(
    id: number,
    dto: { texto?: string; activo?: boolean },
  ) {
    const existe = await this.prisma.subfactor.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Subfactor no encontrado');
    return this.prisma.subfactor.update({
      where: { id },
      data: dto,
      select: { id: true, texto: true, activo: true },
    });
  }

  /** Form 1: the administrator writes the citations; the factor waits inactive for approval. */
  async crearFactor(dto: NuevoFactor): Promise<Estimacion> {
    const dimension = await this.prisma.dimension.findFirst({
      where: { id: dto.idDimension, idProyecto: null },
    });
    if (!dimension) throw new BadRequestException('La dimensión no existe');
    const cortes = await this.cortesVigentes();
    const borrador = dto.subfactores.map((s) => ({
      texto: s.texto.trim(),
      citas: s.citas,
      dois: [...new Set((s.dois ?? []).map(normalizarDoi))],
    }));
    const calculo = calcularIs(
      borrador.map((s, i) => ({ idSubfactor: i, ...s })),
      cortes,
    );

    const fila = await this.prisma.$transaction(async (tx) => {
      const factor = await tx.factor.create({
        data: {
          idDimension: dto.idDimension,
          nombre: dto.nombre.trim(),
          alcanceDefault: dto.alcanceDefault,
          sugeridaDefault: calculo.is,
          origen: 'lit_2020_2025',
          isOrigen: 'manual',
          validadoExpertos: false,
          activo: false,
          subfactores: { create: borrador.map((s) => ({ texto: s.texto })) },
        },
        include: { subfactores: { orderBy: { id: 'asc' } } },
      });
      const citas: CitasSubfactor[] = factor.subfactores.map((s, i) => ({
        idSubfactor: s.id,
        texto: s.texto,
        citas: borrador[i].citas,
        dois: borrador[i].dois,
      }));
      return tx.estimacionIs.create({
        data: {
          idFactor: factor.id,
          modo: 'manual',
          estado: 'propuesta',
          citasPorSubfactorJson: citas as unknown as Prisma.InputJsonValue,
          tc: calculo.tc,
          ns: calculo.ns,
          r: calculo.r,
          il: calculo.il,
          isPropuesta: calculo.is,
        },
        include: { factor: true },
      });
    });
    return toEstimacion(fila, cortes);
  }

  async estimacion(id: number): Promise<Estimacion> {
    const fila = await this.prisma.estimacionIs.findUnique({
      where: { id },
      include: { factor: true },
    });
    if (!fila) throw new NotFoundException('Estimación no encontrada');
    return toEstimacion(
      fila,
      await this.cortesVigentes(),
      this.progresos.get(id) ?? null,
    );
  }

  async estimaciones(estado?: EstadoEstimacionIs): Promise<Estimacion[]> {
    const cortes = await this.cortesVigentes();
    const filas = await this.prisma.estimacionIs.findMany({
      where: { estado },
      include: { factor: true },
      orderBy: { id: 'desc' },
    });
    return filas.map((f) =>
      toEstimacion(f, cortes, this.progresos.get(f.id) ?? null),
    );
  }

  /** Approves with the final citations and publishes a new catalog version (RF-24). */
  async aprobar(
    id: number,
    admin: UsuarioPublico,
    dto: {
      citas?: { idSubfactor: number; citas: number }[];
      isAprobada?: number;
      justificacion?: string;
    },
  ): Promise<Estimacion> {
    const fila = await this.propuesta(id);
    const cortes = await this.cortesVigentes();
    const citas = (
      (fila.citasPorSubfactorJson ?? []) as unknown as CitasSubfactor[]
    ).map((s) => {
      const correccion = dto.citas?.find(
        (c) => c.idSubfactor === s.idSubfactor,
      );
      return correccion ? { ...s, citas: correccion.citas } : s;
    });
    if (
      dto.citas?.some(
        (c) => !citas.some((s) => s.idSubfactor === c.idSubfactor),
      )
    ) {
      throw new BadRequestException(
        'Algún subfactor no pertenece a la estimación',
      );
    }
    const calculo = calcularIs(citas, cortes);
    const isAprobada = dto.isAprobada ?? calculo.is;
    const justificacion = dto.justificacion?.trim() || null;
    if (isAprobada !== calculo.is && !justificacion) {
      throw new BadRequestException(
        'Justifica una IS distinta de la calculada',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.estimacionIs.update({
        where: { id },
        data: {
          estado: 'aprobada',
          citasPorSubfactorJson: citas as unknown as Prisma.InputJsonValue,
          tc: calculo.tc,
          ns: calculo.ns,
          r: calculo.r,
          il: calculo.il,
          isPropuesta: calculo.is,
          isAprobada,
          justificacion,
          aprobadoPorId: admin.id,
        },
      });
      await tx.factor.update({
        where: { id: fila.idFactor },
        data: {
          activo: true,
          sugeridaDefault: isAprobada,
          isOrigen: fila.modo === 'ia' ? 'ia_aprobada' : 'manual',
        },
      });
      const ultima = await tx.catalogoVersion.findFirstOrThrow({
        orderBy: { numero: 'desc' },
      });
      await tx.catalogoVersion.create({
        data: {
          numero: ultima.numero + 1,
          creadoPorId: admin.id,
          motivo: `IS aprobada para el factor ${fila.factor.nombre}`,
          ...cortes,
        },
      });
    });
    return this.estimacion(id);
  }

  async rechazar(id: number, justificacion: string): Promise<Estimacion> {
    await this.propuesta(id);
    await this.prisma.estimacionIs.update({
      where: { id },
      data: { estado: 'rechazada', justificacion: justificacion.trim() },
    });
    return this.estimacion(id);
  }

  private async propuesta(id: number) {
    const fila = await this.prisma.estimacionIs.findUnique({
      where: { id },
      include: { factor: true },
    });
    if (!fila) throw new NotFoundException('Estimación no encontrada');
    if (fila.estado !== 'propuesta') {
      throw new ConflictException(
        'Solo se puede decidir una estimación propuesta',
      );
    }
    return fila;
  }

  private async factorExistente(id: number) {
    const factor = await this.prisma.factor.findUnique({ where: { id } });
    if (!factor) throw new NotFoundException('Factor no encontrado');
    return factor;
  }
}
