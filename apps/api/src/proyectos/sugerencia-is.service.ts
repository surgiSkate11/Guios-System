import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importanciaLiteratura } from '@guios/calculo';
import { createHash } from 'node:crypto';
import type { Prisma, Sector } from '../generated/prisma/client';
import { BIBLIOGRAFIA, type Bibliografia } from '../catalogo/bibliografia';
import { normalizarDoi } from '../catalogo/estimacion';
import { IA_CLIENTE, type IaCliente } from '../ia/ia-cliente';
import { PrismaService } from '../prisma/prisma.service';

/** Bump when the prompt changes so cached answers of the old prompt are not reused. */
const VERSION_PROMPT = 'is-contexto-v3';
/** Upper bound for the whole AI call, fallback models included. */
const ESPERA_MS = 120_000;
const PERIODO_REVISION = 2020;

const INSTRUCCIONES =
  'Eres experto en adopción de software. Recibes en JSON el contexto de una evaluación (tipo de ' +
  'organización y tipo de software) y, por cada factor de la guía GUIOS, su importancia sugerida ' +
  'de la tesis (isTesis, escala 1 Irrelevante, 2 Opcional, 3 Importante, 4 Fundamental, basada en ' +
  'literatura 2008-2019) y la evidencia disponible: tesis2008_2019 y revision2020_2025, con TC = ' +
  'citas, NS = subfactores e IL = importancia de la literatura de 1 a 4, y articulosRecientes: ' +
  'artículos 2020-2025 encontrados en internet (OpenAlex) sobre ese factor. Usa esos artículos y, ' +
  'si puedes, busca en internet ' +
  'evidencia reciente (2020-2025) sobre la relevancia de cada factor para ese tipo de ' +
  'organización y de software y propone su importancia sugerida para este contexto. Mantén el ' +
  'valor de la tesis salvo que la evidencia justifique cambiarlo. Responde SOLO un objeto JSON, ' +
  'sin markdown ni texto adicional: {"factores":[{"id":<id del factor>,"is":<entero de 1 a 4>,' +
  '"justificacion":"<una frase en español de máximo 20 palabras>","confianza":<número entre 0 y 1>}]}, con ' +
  'exactamente un elemento por cada factor recibido.';

export interface FactorContexto {
  id: number;
  nombre: string;
  dimension: string;
  /** IS of the thesis (the deterministic baseline). */
  sugeridaDefault: number;
}

export interface ContextoSugerencia {
  idCatalogoVersion: number;
  sector: Sector;
  tipoSoftware: string | null;
  factores: FactorContexto[];
}

export interface FactorSugerido {
  idFactor: number;
  nombre: string;
  isBase: number;
  isIa: number | null;
  isFinal: number;
  ajustado: boolean;
  justificacion: string | null;
  confianza: number | null;
}

export interface Sugerencia {
  id: number;
  isPorFactor: Map<number, number>;
}

interface Propuesta {
  is: number;
  justificacion: string;
  confianza: number;
}

/** Thrown when the model answer does not follow the strict JSON contract. */
class RespuestaInvalida extends Error {}

/**
 * Validates the model answer: a JSON object with exactly one entry per factor, IS an integer
 * from 1 to 4, a non-empty justification and a confidence from 0 to 1. Anything else discards
 * the whole answer.
 */
export function validarRespuesta(
  texto: string,
  ids: number[],
): Map<number, Propuesta> {
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio < 0 || fin < inicio)
    throw new RespuestaInvalida('no contiene un objeto JSON');
  let datos: unknown;
  try {
    datos = JSON.parse(texto.slice(inicio, fin + 1));
  } catch {
    throw new RespuestaInvalida('JSON mal formado');
  }
  const factores = (datos as { factores?: unknown }).factores;
  if (!Array.isArray(factores))
    throw new RespuestaInvalida('falta la lista "factores"');
  const propuestas = new Map<number, Propuesta>();
  for (const item of factores as Record<string, unknown>[]) {
    const { id, is, justificacion, confianza } = item ?? {};
    if (typeof id !== 'number' || !ids.includes(id) || propuestas.has(id)) {
      throw new RespuestaInvalida(
        `factor desconocido o repetido: ${String(id)}`,
      );
    }
    if (typeof is !== 'number' || !Number.isInteger(is) || is < 1 || is > 4) {
      throw new RespuestaInvalida(`IS fuera de 1-4 en el factor ${id}`);
    }
    if (typeof justificacion !== 'string' || !justificacion.trim()) {
      throw new RespuestaInvalida(`falta la justificación del factor ${id}`);
    }
    if (typeof confianza !== 'number' || confianza < 0 || confianza > 1) {
      throw new RespuestaInvalida(`confianza fuera de 0-1 en el factor ${id}`);
    }
    propuestas.set(id, {
      is,
      justificacion: justificacion.trim().slice(0, 600),
      confianza,
    });
  }
  const faltantes = ids.filter((id) => !propuestas.has(id));
  if (faltantes.length > 0) {
    throw new RespuestaInvalida(`faltan factores: ${faltantes.join(', ')}`);
  }
  return propuestas;
}

/**
 * AI suggested importance per evaluation context. One call for every factor, strict JSON
 * validation, a cap of +/- IA_IS_DESVIO_MAX levels around the thesis IS, a deterministic
 * fallback to the thesis IS, a full audit row per call and a cache of identical contexts.
 */
@Injectable()
export class SugerenciaIsService {
  private readonly logger = new Logger(SugerenciaIsService.name);
  private readonly desvioMax: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IA_CLIENTE) private readonly ia: IaCliente | null,
    config: ConfigService,
    @Inject(BIBLIOGRAFIA) private readonly bibliografia: Bibliografia,
  ) {
    const valor = Number(config.get<string>('IA_IS_DESVIO_MAX') ?? 1);
    this.desvioMax = Number.isInteger(valor) && valor >= 0 ? valor : 1;
  }

  async sugerir(ctx: ContextoSugerencia): Promise<Sugerencia> {
    const tipoSoftware = ctx.tipoSoftware?.trim() || 'no especificado';
    const ids = ctx.factores.map((f) => f.id);
    const clave = createHash('sha256')
      .update(
        JSON.stringify({
          v: VERSION_PROMPT,
          version: ctx.idCatalogoVersion,
          sector: ctx.sector,
          tipoSoftware: tipoSoftware.toLowerCase(),
          modelo: this.ia?.modelo ?? null,
          factores: ctx.factores.map((f) => [f.id, f.sugeridaDefault]),
          desvioMax: this.desvioMax,
        }),
      )
      .digest('hex');

    const enCache = await this.prisma.sugerenciaIs.findFirst({
      where: { clave, origen: 'ia' },
      orderBy: { id: 'desc' },
    });
    if (enCache) return this.aSugerencia(enCache.id, enCache.resultado);

    const factoresEvidencia = await this.evidencia(ctx);
    const contexto = {
      tipoOrganizacion: ctx.sector,
      tipoSoftware,
      factores: ids,
      /** Whether the answer used Google web search; recorded for the audit. */
      busquedaWeb: true,
      /** Recent (2020-2025) articles found in OpenAlex and given to the AI. */
      articulosWeb: 0,
    };
    // Internet evidence from OpenAlex (free), so the AI has recent sources even when the
    // plan does not include Google search. Only when an AI will read it.
    const articulos = this.ia
      ? await this.articulosRecientes(ctx, tipoSoftware)
      : [];
    contexto.articulosWeb = articulos.reduce((n, a) => n + a.length, 0);
    const entrada = JSON.stringify({
      contexto: { tipoOrganizacion: ctx.sector, tipoSoftware },
      factores: factoresEvidencia.map((f, i) => ({
        ...f,
        articulosRecientes: articulos[i] ?? [],
      })),
    });
    const base = { clave, contexto, idCatalogoVersion: ctx.idCatalogoVersion };
    const prompt = `${INSTRUCCIONES}\n\n${entrada}`;

    if (!this.ia) {
      return this.guardarRespaldo(
        base,
        prompt,
        null,
        null,
        ctx,
        'IA no configurada',
      );
    }
    const ia = this.ia;
    const consultar = (busquedaWeb: boolean) =>
      Promise.race([
        ia.completar(INSTRUCCIONES, entrada, { busquedaWeb }),
        new Promise<never>((_, rechazar) =>
          setTimeout(
            () => rechazar(new Error('tiempo de espera agotado')),
            ESPERA_MS,
          ).unref(),
        ),
      ]);
    let respuesta: string;
    try {
      try {
        respuesta = await consultar(true);
      } catch (error) {
        // Free plans may reject web search (429): ask again with the evidence we send.
        if (!(error instanceof Error) || !error.message.includes('429'))
          throw error;
        this.logger.warn(
          'Web search rejected by the AI plan; retrying without it',
        );
        contexto.busquedaWeb = false;
        respuesta = await consultar(false);
      }
    } catch (error) {
      const motivo = `Error de la IA: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.warn(motivo);
      return this.guardarRespaldo(
        base,
        prompt,
        this.ia.modelo,
        null,
        ctx,
        motivo,
      );
    }

    let propuestas: Map<number, Propuesta>;
    try {
      propuestas = validarRespuesta(respuesta, ids);
    } catch (error) {
      const motivo = `Respuesta inválida: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.warn(motivo);
      return this.guardarRespaldo(
        base,
        prompt,
        this.ia.modelo,
        respuesta,
        ctx,
        motivo,
      );
    }

    const resultado: FactorSugerido[] = ctx.factores.map((f) => {
      const p = propuestas.get(f.id)!;
      const minimo = Math.max(1, f.sugeridaDefault - this.desvioMax);
      const maximo = Math.min(4, f.sugeridaDefault + this.desvioMax);
      const isFinal = Math.min(maximo, Math.max(minimo, p.is));
      return {
        idFactor: f.id,
        nombre: f.nombre,
        isBase: f.sugeridaDefault,
        isIa: p.is,
        isFinal,
        ajustado: isFinal !== p.is,
        justificacion: p.justificacion,
        confianza: p.confianza,
      };
    });
    const fila = await this.prisma.sugerenciaIs.create({
      data: {
        ...base,
        prompt,
        modelo: this.ia.modelo,
        respuesta,
        resultado: resultado as unknown as Prisma.InputJsonValue,
        origen: 'ia',
      },
    });
    return this.aSugerencia(fila.id, fila.resultado);
  }

  /** Thesis anchors (2008-2019) and 2020-2025 measurements of the version, with their IL. */
  private async evidencia(ctx: ContextoSugerencia) {
    const version = await this.prisma.catalogoVersion.findUniqueOrThrow({
      where: { id: ctx.idCatalogoVersion },
      include: {
        anclas: { where: { idFactor: { in: ctx.factores.map((f) => f.id) } } },
      },
    });
    const cortes = { rq1: version.rq1, rq2: version.rq2, rq3: version.rq3 };
    const medida = (a?: { citas: number; ns: number; r: number }) =>
      a
        ? { tc: a.citas, ns: a.ns, il: importanciaLiteratura(a.r, cortes) }
        : null;
    return ctx.factores.map((f) => {
      const anclas = version.anclas.filter((a) => a.idFactor === f.id);
      return {
        id: f.id,
        nombre: f.nombre,
        dimension: f.dimension,
        isTesis: f.sugeridaDefault,
        tesis2008_2019: medida(
          anclas.find((a) => a.periodoDesde < PERIODO_REVISION),
        ),
        revision2020_2025: medida(
          anclas.find((a) => a.periodoDesde >= PERIODO_REVISION),
        ),
      };
    });
  }

  /** Up to three 2020-2025 articles per factor from OpenAlex; a failed search yields none. */
  private async articulosRecientes(
    ctx: ContextoSugerencia,
    tipoSoftware: string,
  ) {
    const contexto =
      tipoSoftware === 'no especificado' ? '' : ` ${tipoSoftware}`;
    return Promise.all(
      ctx.factores.map((f) =>
        this.bibliografia
          .buscar(`${f.nombre}${contexto} software adoption`, 5)
          .then((encontrados) =>
            encontrados
              .filter((a) => a.anio >= PERIODO_REVISION && a.anio <= 2025)
              .slice(0, 3)
              .map((a) => ({
                titulo: a.titulo,
                anio: a.anio,
                doi: normalizarDoi(a.doi),
              })),
          )
          .catch((error: unknown) => {
            this.logger.warn(
              `OpenAlex search failed for ${f.nombre}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return [];
          }),
      ),
    );
  }

  private async guardarRespaldo(
    base: { clave: string; contexto: object; idCatalogoVersion: number },
    prompt: string,
    modelo: string | null,
    respuesta: string | null,
    ctx: ContextoSugerencia,
    motivo: string,
  ): Promise<Sugerencia> {
    const resultado: FactorSugerido[] = ctx.factores.map((f) => ({
      idFactor: f.id,
      nombre: f.nombre,
      isBase: f.sugeridaDefault,
      isIa: null,
      isFinal: f.sugeridaDefault,
      ajustado: false,
      justificacion: null,
      confianza: null,
    }));
    const fila = await this.prisma.sugerenciaIs.create({
      data: {
        ...base,
        contexto: base.contexto,
        prompt,
        modelo,
        respuesta,
        resultado: resultado as unknown as Prisma.InputJsonValue,
        origen: 'respaldo',
        motivoRespaldo: motivo.slice(0, 500),
      },
    });
    return this.aSugerencia(fila.id, fila.resultado);
  }

  private aSugerencia(id: number, resultado: Prisma.JsonValue): Sugerencia {
    const factores = resultado as unknown as FactorSugerido[];
    return {
      id,
      isPorFactor: new Map(factores.map((f) => [f.idFactor, f.isFinal])),
    };
  }
}
