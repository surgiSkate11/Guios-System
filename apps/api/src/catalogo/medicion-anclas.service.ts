import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  cuartilesInclusivos,
  desviacionEstandarPoblacional,
  mediana,
  promedio,
  type Cortes,
} from '@guios/calculo';
import type { UsuarioPublico } from '../auth/usuario-publico';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoAdminService } from './catalogo-admin.service';
import type { Estimacion, Progreso } from './estimacion';
import { EstimacionIaService } from './estimacion-ia.service';

/** Section 6 (RN-14): peer-reviewed evidence published between 2020 and 2025. */
const PERIODO = { desde: 2020, hasta: 2025 };
/** A stuck external service must not keep the job "en_curso" forever (RNF-06). */
const ESPERA_MAXIMA_MS = 15 * 60 * 1000;
const INTERVALO_MS = 100;
const MOTIVO = 'Medición de anclas 2020-2025';
const JUSTIFICACION =
  'Medición de anclas: estimación temporal, no se publica como IS del factor';

export type EstadoMedicion = 'inactiva' | 'en_curso' | 'completada' | 'fallida';

/** One reference factor (anchor) measured with the current method. */
export interface AnclaMedida {
  idFactor: number;
  nombre: string;
  /** TC, total citations (RN-01). */
  citas: number;
  /** NS, number of measured subfactors. */
  ns: number;
  /** r = TC / NS, the value located by the quartile cuts (RN-01, RN-02). */
  r: number;
}

/** Spread of the anchors' r: the dispersion the spec plots as a box plot. */
export interface DispersionAnclas {
  minimo: number;
  maximo: number;
  mediana: number;
  promedio: number;
  desviacion: number;
}

export interface MedicionAnclas {
  estado: EstadoMedicion;
  progreso: Progreso | null;
  factorActual: string | null;
  error: string | null;
  version: { id: number; numero: number } | null;
  cortes: Cortes | null;
  dispersion: DispersionAnclas | null;
  anclas: AnclaMedida[];
}

function dispersion(valores: readonly number[]): DispersionAnclas | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return {
    minimo: ordenados[0],
    maximo: ordenados[ordenados.length - 1],
    mediana: mediana(valores),
    promedio: promedio(valores),
    desviacion: desviacionEstandarPoblacional(valores),
  };
}

/**
 * Anchor measurement (spec section 6): the factors already in the catalog are measured with
 * the same method used for a new factor, and their r values give the quartile cuts of a new
 * catalog version. It only runs when factors are added or re-calibrated, never per project.
 *
 * `EstimacionIaService` is reused as-is: this service starts one estimation per factor,
 * waits for it, keeps only the verified numbers and rejects the temporary estimation so the
 * factor stays editable. The AI never computes cuts or importances (RNF-03, RNF-11).
 */
@Injectable()
export class MedicionAnclasService {
  private readonly logger = new Logger(MedicionAnclasService.name);
  /** Last measurement of this process, exposed while it runs and after it ends. */
  private trabajo: MedicionAnclas | null = null;
  /** In-memory mutex: one measurement at a time (RNF-12). */
  private enCurso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: CatalogoAdminService,
    private readonly ia: EstimacionIaService,
  ) {}

  /** Current state, or the anchors published with the current catalog version. */
  async estado(): Promise<MedicionAnclas> {
    if (this.trabajo) return this.trabajo;
    const version = await this.prisma.catalogoVersion.findFirst({
      orderBy: { numero: 'desc' },
      include: {
        anclas: {
          orderBy: { idFactor: 'asc' },
          include: { factor: { select: { nombre: true } } },
        },
      },
    });
    if (!version) {
      return {
        estado: 'inactiva',
        progreso: null,
        factorActual: null,
        error: null,
        version: null,
        cortes: null,
        dispersion: null,
        anclas: [],
      };
    }
    const anclas = version.anclas.map((a) => ({
      idFactor: a.idFactor,
      nombre: a.factor.nombre,
      citas: a.citas,
      ns: a.ns,
      r: a.r,
    }));
    return {
      estado: 'inactiva',
      progreso: null,
      factorActual: null,
      error: null,
      version: { id: version.id, numero: version.numero },
      cortes: { rq1: version.rq1, rq2: version.rq2, rq3: version.rq3 },
      dispersion: dispersion(anclas.map((a) => a.r)),
      anclas,
    };
  }

  /** Starts the measurement in the background and returns its initial state (RNF-12). */
  async medir(admin: UsuarioPublico): Promise<MedicionAnclas> {
    if (!this.ia.disponible) {
      throw new ConflictException(
        'La medición de anclas requiere la IA configurada',
      );
    }
    if (this.enCurso) {
      throw new ConflictException('Ya hay una medición de anclas en curso');
    }
    this.enCurso = true;
    let factores: { id: number; nombre: string }[];
    try {
      factores = await this.factoresMedibles();
    } catch (error) {
      this.enCurso = false;
      throw error;
    }
    const trabajo: MedicionAnclas = {
      estado: 'en_curso',
      progreso: { hechos: 0, total: factores.length },
      factorActual: null,
      error: null,
      version: null,
      cortes: null,
      dispersion: null,
      anclas: [],
    };
    this.trabajo = trabajo;
    setImmediate(() => void this.ejecutar(factores, admin));
    return trabajo;
  }

  /**
   * Active factors of the global catalog that still have no anchor in the current version:
   * measurement is incremental, so an existing anchor is never measured again and keeps its
   * citations, ns and r (section 6). The anchors are not hardcoded to the thesis 18 either.
   */
  private async factoresMedibles(): Promise<{ id: number; nombre: string }[]> {
    const factores = await this.prisma.factor.findMany({
      where: {
        activo: true,
        dimension: { idProyecto: null },
        subfactores: { some: { activo: true } },
      },
      orderBy: { id: 'asc' },
      select: { id: true, nombre: true },
    });
    if (factores.length === 0) {
      throw new BadRequestException('No hay factores activos para medir');
    }
    // Without a loaded catalog there are no cuts to compare against.
    await this.catalogo.cortesVigentes();
    const version = await this.prisma.catalogoVersion.findFirst({
      orderBy: { numero: 'desc' },
      select: { id: true },
    });
    if (!version) return factores;
    const medidas = await this.prisma.medicionAncla.findMany({
      where: { idCatalogoVersion: version.id },
      select: { idFactor: true },
    });
    const conAncla = new Set(medidas.map((a) => a.idFactor));
    const nuevas = factores.filter((f) => !conAncla.has(f.id));
    if (nuevas.length === 0) {
      throw new BadRequestException(
        'Todos los factores activos ya tienen ancla; no hay factores nuevos por medir',
      );
    }
    return nuevas;
  }

  private async ejecutar(
    factores: readonly { id: number; nombre: string }[],
    admin: UsuarioPublico,
  ): Promise<void> {
    const anclas: AnclaMedida[] = [];
    try {
      for (let i = 0; i < factores.length; i++) {
        const factor = factores[i];
        this.progreso(i, factor.nombre, anclas);
        const estimacion = await this.ia.iniciar(factor.id);
        const fin = await this.esperar(estimacion.id);
        if (fin.estado !== 'propuesta') {
          throw new Error(
            fin.error ??
              `La estimación del factor ${factor.nombre} terminó en estado "${fin.estado}"`,
          );
        }
        if (fin.tc === null || fin.r === null) {
          throw new Error(
            `La estimación del factor ${factor.nombre} no tiene citas verificadas`,
          );
        }
        anclas.push({
          idFactor: factor.id,
          nombre: factor.nombre,
          citas: fin.tc,
          ns: fin.ns,
          r: fin.r,
        });
        // The temporary estimation must not block later catalog edits (RF-24).
        await this.catalogo.rechazar(fin.id, JUSTIFICACION);
        this.progreso(i + 1, null, anclas);
      }

      // The cuts are computed over every anchor of the version, inherited ones included.
      const publicado = await this.publicar(anclas, admin);
      this.trabajo = {
        estado: 'completada',
        progreso: null,
        factorActual: null,
        error: null,
        version: publicado.version,
        cortes: publicado.cortes,
        dispersion: dispersion(publicado.anclas.map((a) => a.r)),
        anclas: publicado.anclas,
      };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Anchor measurement failed: ${mensaje}`);
      this.trabajo = {
        estado: 'fallida',
        progreso: null,
        factorActual: null,
        error: mensaje,
        version: null,
        cortes: null,
        dispersion: null,
        anclas,
      };
    } finally {
      this.enCurso = false;
    }
  }

  private progreso(
    hechos: number,
    factorActual: string | null,
    anclas: AnclaMedida[],
  ): void {
    if (!this.trabajo) return;
    this.trabajo = {
      ...this.trabajo,
      progreso: {
        hechos,
        total: this.trabajo.progreso?.total ?? anclas.length,
      },
      factorActual,
      anclas: [...anclas],
    };
  }

  /** Watches the background estimation started by `EstimacionIaService`. */
  private async esperar(id: number): Promise<Estimacion> {
    const limite = Date.now() + ESPERA_MAXIMA_MS;
    for (;;) {
      const fila = await this.catalogo.estimacion(id);
      if (fila.estado !== 'en_curso') return fila;
      if (Date.now() > limite) {
        throw new Error('La estimación con IA excedió el tiempo de espera');
      }
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
  }

  /**
   * Publishes one new catalog version carrying the anchors inherited from the previous one,
   * one new anchor row per newly measured factor, and the quartile cuts over the whole set.
   * The inherited anchors keep their own search terms, period, citations, ns and r, so an
   * incremental measurement never rewrites an existing anchor. Projects keep their own
   * version, so no IS of an existing project changes (RF-17).
   */
  private async publicar(
    nuevas: readonly AnclaMedida[],
    admin: UsuarioPublico,
  ): Promise<{
    version: { id: number; numero: number };
    cortes: Cortes;
    anclas: AnclaMedida[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      const ultima = await tx.catalogoVersion.findFirst({
        orderBy: { numero: 'desc' },
        include: {
          anclas: {
            orderBy: { idFactor: 'asc' },
            include: { factor: { select: { nombre: true } } },
          },
        },
      });
      const previas = ultima?.anclas ?? [];
      const anclas = [
        ...previas.map((a) => ({
          idFactor: a.idFactor,
          nombre: a.factor.nombre,
          citas: a.citas,
          ns: a.ns,
          r: a.r,
        })),
        ...nuevas,
      ].sort((a, b) => a.idFactor - b.idFactor);
      const cortes = cuartilesInclusivos(anclas.map((a) => a.r));
      const version = await tx.catalogoVersion.create({
        data: {
          numero: (ultima?.numero ?? 0) + 1,
          motivo: MOTIVO,
          creadoPorId: admin.id,
          ...cortes,
        },
      });
      for (const previa of previas) {
        await tx.medicionAncla.create({
          data: {
            idFactor: previa.idFactor,
            idCatalogoVersion: version.id,
            terminosBusqueda: previa.terminosBusqueda ?? {},
            periodoDesde: previa.periodoDesde,
            periodoHasta: previa.periodoHasta,
            citas: previa.citas,
            ns: previa.ns,
            r: previa.r,
          },
        });
      }
      for (const ancla of nuevas) {
        const temporal = await tx.estimacionIs.findFirst({
          where: { idFactor: ancla.idFactor, estado: 'rechazada' },
          orderBy: { id: 'desc' },
          select: { terminosBusqueda: true },
        });
        await tx.medicionAncla.create({
          data: {
            idFactor: ancla.idFactor,
            idCatalogoVersion: version.id,
            terminosBusqueda: temporal?.terminosBusqueda ?? {},
            periodoDesde: PERIODO.desde,
            periodoHasta: PERIODO.hasta,
            citas: ancla.citas,
            ns: ancla.ns,
            r: ancla.r,
          },
        });
      }
      return {
        version: { id: version.id, numero: version.numero },
        cortes,
        anclas,
      };
    });
  }
}
