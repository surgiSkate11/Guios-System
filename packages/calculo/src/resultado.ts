// Result rules RN-09 to RN-12: SWOT (FODA), adoption level and metrics.
import { esRelevante, type MetodoConsolidacion } from "./consolidacion.js";
import { desviacionEstandarPoblacional, mediana, promedio } from "./estadistica.js";
import { validarImportancia, type Importancia } from "./importancia.js";
import { validarPonderacionMedia } from "./ponderacion.js";

/** Factor scope: internal (depends on the organization) or external (depends on the software). */
export type Alcance = "interno" | "externo";

/** SWOT classification of a factor. */
export type Foda = "fortaleza" | "oportunidad" | "debilidad" | "amenaza";

/** Adoption level of a software. */
export type NivelAdopcion = "A" | "B" | "C";

/** Default SWOT threshold U (parametrizable). */
export const UMBRAL_FODA_POR_DEFECTO = 3;

const METRICA_MINIMA = 0;
const METRICA_MAXIMA = 100;

/**
 * RN-09. SWOT classification (thesis eq. 5.3):
 * internal and PM >= U -> strength; external and PM >= U -> opportunity;
 * internal and PM < U -> weakness; external and PM < U -> threat.
 */
export function clasificarFoda(
  alcance: Alcance,
  pm: number,
  umbral: number = UMBRAL_FODA_POR_DEFECTO,
): Foda {
  validarPonderacionMedia(pm);
  if (!Number.isFinite(umbral) || umbral < 1 || umbral > 4) {
    throw new RangeError(`SWOT threshold must be between 1 and 4, got ${umbral}`);
  }
  const cumple = pm >= umbral;
  if (alcance === "interno") return cumple ? "fortaleza" : "debilidad";
  if (alcance === "externo") return cumple ? "oportunidad" : "amenaza";
  throw new RangeError(`Unknown scope: ${String(alcance)}`);
}

/** A relevant factor's IR and its SWOT classification, input of RN-10. */
export interface FactorClasificado {
  ir: Importancia;
  foda: Foda;
}

/**
 * RN-10. Adoption level over the relevant factors (IR > 1; the rest are ignored):
 * A if every one is a strength or opportunity; B if weaknesses or threats appear only
 * in factors with IR 2; C if one appears in a factor with IR 3 or 4.
 */
export function nivelAdopcion(factores: readonly FactorClasificado[]): NivelAdopcion {
  const relevantes = factores.filter((f) => esRelevante(f.ir));
  if (relevantes.length === 0) {
    throw new RangeError("At least one relevant factor is required to decide the adoption level");
  }
  const negativos = relevantes.filter((f) => f.foda === "debilidad" || f.foda === "amenaza");
  if (negativos.length === 0) return "A";
  return negativos.some((f) => f.ir >= 3) ? "C" : "B";
}

/** A factor's IR and the judge's PM (null when the judge has no PM), input of RN-11. */
export interface FactorPonderado {
  ir: Importancia;
  pm: number | null;
}

/**
 * RN-11. Judge's metric from 0 to 100:
 * 100 * sum(IR * (PM - 1) / 3) / sum(IR), over the relevant factors with PM.
 * Returns null when no relevant factor has PM.
 */
export function metricaJurado(factores: readonly FactorPonderado[]): number | null {
  let numerador = 0;
  let denominador = 0;
  for (const { ir, pm } of factores) {
    validarImportancia(ir, "IR");
    if (!esRelevante(ir) || pm === null) continue;
    validarPonderacionMedia(pm);
    numerador += ir * ((pm - 1) / 3);
    denominador += ir;
  }
  return denominador === 0 ? null : (METRICA_MAXIMA * numerador) / denominador;
}

/** Final metric of a software with its spread across judges. */
export interface ResultadoMetrica {
  final: number;
  minimo: number;
  maximo: number;
  desviacion: number;
}

/**
 * RN-12. Final metric: median (or mean) of the judges' scores, with minimum, maximum
 * and population standard deviation. Judges without score are skipped; returns null
 * when none has one.
 */
export function metricaFinal(
  scores: readonly (number | null)[],
  metodo: MetodoConsolidacion = "mediana",
): ResultadoMetrica | null {
  const valores = scores.filter((s): s is number => s !== null);
  for (const s of valores) {
    if (!Number.isFinite(s) || s < METRICA_MINIMA || s > METRICA_MAXIMA) {
      throw new RangeError(`Score must be between ${METRICA_MINIMA} and ${METRICA_MAXIMA}, got ${s}`);
    }
  }
  if (valores.length === 0) return null;
  return {
    final: metodo === "promedio" ? promedio(valores) : mediana(valores),
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
    desviacion: desviacionEstandarPoblacional(valores),
  };
}
