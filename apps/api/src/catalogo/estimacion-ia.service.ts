import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { IA_CLIENTE, type IaCliente } from '../ia/ia-cliente';
import { PrismaService } from '../prisma/prisma.service';
import { BIBLIOGRAFIA, type Articulo, type Bibliografia } from './bibliografia';
import { CatalogoAdminService } from './catalogo-admin.service';
import {
  calcularIs,
  normalizarDoi,
  type CitasSubfactor,
  type Estimacion,
} from './estimacion';

const CANDIDATOS_POR_SUBFACTOR = 10;
const PERIODO = { desde: 2020, hasta: 2025 };

const INSTRUCCIONES =
  'You classify scientific evidence. For each candidate article, decide whether its abstract ' +
  'supports the given software-evaluation subfactor. Answer ONLY a JSON array of objects ' +
  '{"i": number, "respalda": boolean, "cita": string}, where "cita" is a short sentence copied ' +
  'LITERALLY from the abstract that supports the subfactor (empty when respalda is false).';

interface Clasificacion {
  i: number;
  respalda: boolean;
  cita: string;
}

interface Descarte {
  subfactor: number;
  doi: string;
  motivo: string;
}

/** Parses the AI answer defensively: anything malformed counts as "does not support". */
function parsearClasificacion(texto: string): Clasificacion[] {
  const inicio = texto.indexOf('[');
  const fin = texto.lastIndexOf(']');
  if (inicio < 0 || fin < inicio) return [];
  try {
    const datos = JSON.parse(texto.slice(inicio, fin + 1)) as unknown;
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (d): d is Clasificacion =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as Clasificacion).i === 'number' &&
        typeof (d as Clasificacion).respalda === 'boolean' &&
        typeof (d as Clasificacion).cita === 'string',
    );
  } catch {
    return [];
  }
}

const normalizarTexto = (s: string) =>
  s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Form 2 (RF-23): the bibliographic service finds 2020-2025 articles, the AI classifies them
 * with a literal quote, the server discards anything unverifiable (RNF-11) and the code counts
 * the citations and computes the IS. Runs in the background and reports progress (RNF-12).
 */
@Injectable()
export class EstimacionIaService implements OnModuleInit {
  private readonly logger = new Logger(EstimacionIaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: CatalogoAdminService,
    @Inject(IA_CLIENTE) private readonly ia: IaCliente | null,
    @Inject(BIBLIOGRAFIA) private readonly bibliografia: Bibliografia,
  ) {}

  /** Estimations run in memory: any still en_curso after a restart was interrupted. */
  async onModuleInit(): Promise<void> {
    const { count } = await this.prisma.estimacionIs.updateMany({
      where: { estado: 'en_curso' },
      data: {
        estado: 'rechazada',
        justificacion:
          'Falló la estimación con IA; usa la carga manual de citas',
        descartesJson: {
          error: 'La estimación se interrumpió al reiniciar el servidor',
        },
      },
    });
    if (count > 0)
      this.logger.warn(`${count} interrupted AI estimations marked as failed`);
  }

  get disponible(): boolean {
    return this.ia !== null;
  }

  async iniciar(idFactor: number): Promise<Estimacion> {
    const factor = await this.prisma.factor.findUnique({
      where: { id: idFactor },
      include: {
        subfactores: { where: { activo: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!factor) throw new NotFoundException('Factor no encontrado');
    if (factor.subfactores.length === 0) {
      throw new BadRequestException('El factor no tiene subfactores activos');
    }
    await this.catalogo.cortesVigentes();
    const fila = await this.prisma.estimacionIs.create({
      data: {
        idFactor,
        modo: 'ia',
        estado: 'en_curso',
        ns: factor.subfactores.length,
        modelo: this.ia!.modelo,
      },
    });
    this.catalogo.progresos.set(fila.id, {
      hechos: 0,
      total: factor.subfactores.length,
    });
    const respuesta = await this.catalogo.estimacion(fila.id);
    // Start after answering so the client always receives the initial en_curso state.
    setImmediate(
      () => void this.ejecutar(fila.id, factor.nombre, factor.subfactores),
    );
    return respuesta;
  }

  private async ejecutar(
    id: number,
    nombreFactor: string,
    subfactores: { id: number; texto: string }[],
  ): Promise<void> {
    const terminos: string[] = [];
    const candidatosJson: Record<number, Articulo[]> = {};
    const clasificacionJson: Record<number, Clasificacion[]> = {};
    const descartes: Descarte[] = [];
    const citas: CitasSubfactor[] = [];
    try {
      for (const [n, s] of subfactores.entries()) {
        const consulta = `${nombreFactor} ${s.texto}`;
        terminos.push(consulta);
        const encontrados = await this.bibliografia.buscar(
          consulta,
          CANDIDATOS_POR_SUBFACTOR,
        );
        const validos: Articulo[] = [];
        for (const a of encontrados) {
          const doi = normalizarDoi(a.doi);
          const motivo = !/^10\.\d{4,9}\/\S+$/.test(doi)
            ? 'sin DOI válido'
            : a.anio < PERIODO.desde || a.anio > PERIODO.hasta
              ? 'fuera del periodo 2020-2025'
              : a.tipo !== 'article'
                ? 'no es un artículo revisado por pares'
                : !a.resumen.trim()
                  ? 'sin resumen'
                  : null;
          if (motivo) descartes.push({ subfactor: s.id, doi, motivo });
          else if (!validos.some((v) => normalizarDoi(v.doi) === doi))
            validos.push(a);
        }
        candidatosJson[s.id] = validos;

        const dois = new Set<string>();
        if (validos.length > 0) {
          // RNF-13: only the factor, the subfactor text and public abstracts are sent.
          const entrada = JSON.stringify({
            factor: nombreFactor,
            subfactor: s.texto,
            candidatos: validos.map((a, i) => ({
              i,
              doi: normalizarDoi(a.doi),
              titulo: a.titulo,
              resumen: a.resumen,
            })),
          });
          const clasificacion = parsearClasificacion(
            await this.ia!.completar(INSTRUCCIONES, entrada),
          );
          clasificacionJson[s.id] = clasificacion;
          for (const c of clasificacion) {
            const articulo = validos[c.i];
            if (!articulo || !c.respalda) continue;
            const doi = normalizarDoi(articulo.doi);
            if (
              !c.cita.trim() ||
              !normalizarTexto(articulo.resumen).includes(
                normalizarTexto(c.cita),
              )
            ) {
              descartes.push({
                subfactor: s.id,
                doi,
                motivo: 'la cita no aparece en el resumen',
              });
              continue;
            }
            dois.add(doi);
          }
        }
        citas.push({
          idSubfactor: s.id,
          texto: s.texto,
          citas: dois.size,
          dois: [...dois],
        });
        this.catalogo.progresos.set(id, {
          hechos: n + 1,
          total: subfactores.length,
        });
      }

      const calculo = calcularIs(citas, await this.catalogo.cortesVigentes());
      await this.prisma.estimacionIs.update({
        where: { id },
        data: {
          estado: 'propuesta',
          terminosBusqueda: terminos,
          candidatosJson: candidatosJson as unknown as Prisma.InputJsonValue,
          clasificacionJson:
            clasificacionJson as unknown as Prisma.InputJsonValue,
          descartesJson: descartes as unknown as Prisma.InputJsonValue,
          citasPorSubfactorJson: citas as unknown as Prisma.InputJsonValue,
          tc: calculo.tc,
          ns: calculo.ns,
          r: calculo.r,
          il: calculo.il,
          isPropuesta: calculo.is,
        },
      });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI estimation ${id} failed: ${mensaje}`);
      await this.prisma.estimacionIs
        .update({
          where: { id },
          data: {
            estado: 'rechazada',
            justificacion:
              'Falló la estimación con IA; usa la carga manual de citas',
            descartesJson: {
              error: mensaje,
              descartes,
            } as unknown as Prisma.InputJsonValue,
          },
        })
        .catch(() => undefined);
    } finally {
      this.catalogo.progresos.delete(id);
    }
  }
}
