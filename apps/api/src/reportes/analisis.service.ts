import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { UsuarioPublico } from '../auth/usuario-publico';
import type { AnalisisIa } from '../generated/prisma/client';
import { IA_CLIENTE, type IaCliente } from '../ia/ia-cliente';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../proyectos/acceso.service';
import {
  ResultadosService,
  type ResultadoProyecto,
} from '../resultados/resultados.service';

export interface Analisis {
  id: number;
  texto: string;
  modelo: string;
  estado: 'completado' | 'fallido';
  respaldo: boolean;
  creadoEn: string;
}

const MODELO_RESPALDO = 'respaldo';

const INSTRUCCIONES =
  'Eres analista de adopción de software. Redacta en español, en 3 a 5 párrafos, un análisis ' +
  'de los resultados de evaluación que recibes en JSON: compara los softwares, explica su nivel ' +
  'de adopción (A, B o C), sus fortalezas, oportunidades, debilidades y amenazas y las banderas ' +
  'de ambigüedad. Usa SOLO los números del JSON, sin calcular ni inventar otros. No decidas la ' +
  'adopción: eso ya lo calculó el sistema.';

const f2 = (n: number) => n.toFixed(2);

/** Pseudonymized input for the AI: no judge names or emails ever leave the server (RNF-05). */
export function entradaAnalisis(nombreProyecto: string, r: ResultadoProyecto) {
  const alias = new Map<number, string>();
  r.softwares
    .flatMap((s) => s.scoresJurado)
    .forEach(
      (j) =>
        alias.has(j.idUsuario) ||
        alias.set(j.idUsuario, `Jurado ${alias.size + 1}`),
    );
  const softwareDe = (id?: number) =>
    r.softwares.find((s) => s.id === id)?.nombre;
  return {
    proyecto: nombreProyecto,
    softwares: [...r.softwares]
      .sort((a, b) => a.ranking - b.ranking)
      .map((s) => ({
        nombre: s.nombre,
        ranking: s.ranking,
        nivel: s.nivel,
        metrica: {
          final: f2(s.metrica.final),
          minimo: f2(s.metrica.minimo),
          maximo: f2(s.metrica.maximo),
          desviacion: f2(s.metrica.desviacion),
        },
        scores: s.scoresJurado.map((j) => ({
          jurado: alias.get(j.idUsuario),
          score: j.score === null ? null : f2(j.score),
        })),
        factores: s.factores.map((x) => ({
          nombre: x.nombre,
          ir: x.ir,
          pm: x.pmConsolidada === null ? null : f2(x.pmConsolidada),
          foda: x.foda,
        })),
      })),
    banderas: r.banderas.map((b) => ({
      tipo: b.tipo,
      software: softwareDe(b.idSoftware),
      jurado: b.idUsuario === undefined ? undefined : alias.get(b.idUsuario),
    })),
  };
}

type Entrada = ReturnType<typeof entradaAnalisis>;

/** Every number in the text must appear in the input (RF-16: the text never alters numbers). */
export function numerosValidos(texto: string, entrada: Entrada): boolean {
  const permitidos = new Set<string>();
  const json = JSON.stringify(entrada);
  for (const n of json.match(/\d+(?:\.\d+)?/g) ?? []) {
    const v = Number(n);
    for (const forma of [
      n,
      String(v),
      v.toFixed(1),
      v.toFixed(2),
      String(Math.round(v)),
    ]) {
      permitidos.add(forma);
    }
  }
  const usados = texto.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return usados.every((n) => permitidos.has(n.replace(',', '.')));
}

/** Deterministic text used when the AI is unavailable or its answer is rejected (RNF-06). */
export function textoRespaldo(e: Entrada): string {
  const lineas = [`Análisis de resultados del proyecto ${e.proyecto}.`];
  for (const s of e.softwares) {
    const grupo = (foda: string) =>
      s.factores
        .filter((f) => f.foda === foda)
        .map((f) => f.nombre)
        .join(', ') || 'ninguna';
    lineas.push(
      `${s.nombre} ocupa el puesto ${s.ranking} con una métrica de ${s.metrica.final} ` +
        `(mínimo ${s.metrica.minimo}, máximo ${s.metrica.maximo}) y nivel ${s.nivel}. ` +
        `Fortalezas: ${grupo('fortaleza')}. Oportunidades: ${grupo('oportunidad')}. ` +
        `Debilidades: ${grupo('debilidad')}. Amenazas: ${grupo('amenaza')}.`,
    );
  }
  lineas.push(
    e.banderas.length === 0
      ? 'No se detectaron banderas de ambigüedad.'
      : `Banderas de ambigüedad: ${e.banderas.map((b) => b.tipo.replaceAll('_', ' ')).join(', ')}.`,
  );
  return lineas.join('\n\n');
}

const toAnalisis = (a: AnalisisIa): Analisis => ({
  id: a.id,
  texto: a.salida ?? '',
  modelo: a.modelo,
  estado: a.estado === 'completado' ? 'completado' : 'fallido',
  respaldo: a.estado !== 'completado',
  creadoEn: a.creadoEn.toISOString(),
});

/** Text analysis of the results written by AI, with validation and fallback (RF-16). */
@Injectable()
export class AnalisisService {
  private readonly logger = new Logger(AnalisisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly resultados: ResultadosService,
    @Inject(IA_CLIENTE) private readonly ia: IaCliente | null,
  ) {}

  async generar(
    idProyecto: number,
    usuario: UsuarioPublico,
  ): Promise<Analisis> {
    const { proyecto } = await this.acceso.comoCoordinador(idProyecto, usuario);
    const resultado = await this.resultados.ultimo(idProyecto, usuario);
    const entrada = entradaAnalisis(proyecto.nombre, resultado);

    let salida = textoRespaldo(entrada);
    let estado: 'completado' | 'fallido' = 'fallido';
    if (this.ia) {
      try {
        const texto = await this.ia.completar(
          INSTRUCCIONES,
          JSON.stringify(entrada),
        );
        if (numerosValidos(texto, entrada)) {
          salida = texto;
          estado = 'completado';
        } else {
          this.logger.warn(
            'AI analysis rejected: it contains numbers not present in the results',
          );
        }
      } catch (error) {
        this.logger.warn(
          `AI analysis failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    const fila = await this.prisma.analisisIa.create({
      data: {
        idProyecto,
        entrada: entrada,
        salida,
        modelo: this.ia?.modelo ?? MODELO_RESPALDO,
        estado,
      },
    });
    return toAnalisis(fila);
  }

  async ultimo(idProyecto: number, usuario: UsuarioPublico): Promise<Analisis> {
    await this.acceso.obtener(idProyecto, usuario);
    const fila = await this.prisma.analisisIa.findFirst({
      where: { idProyecto },
      orderBy: { id: 'desc' },
    });
    if (!fila) throw new NotFoundException('Aún no hay análisis');
    return toAnalisis(fila);
  }
}
