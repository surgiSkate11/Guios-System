// Ambiguity flags RN-13. Thresholds are parametrizable; the dispersion flags
// (disagreement and discussed factor) need 2 or more judges.
import { desviacionEstandarPoblacional } from "./estadistica.js";
import { validarImportancia, type Importancia } from "./importancia.js";
import { DESCONOZCO, validarPonderacionMedia, type Calificacion } from "./ponderacion.js";
import type { NivelAdopcion } from "./resultado.js";

/** RN-13 thresholds. `datosInciertos` is a percentage from 0 to 100. */
export interface UmbralesBanderas {
  desacuerdo: number;
  empateTecnico: number;
  metricaAlta: number;
  factorDiscutido: number;
  datosInciertos: number;
}

/** Default thresholds, as shown on the Configuración screen. */
export const UMBRALES_BANDERAS_POR_DEFECTO: Readonly<UmbralesBanderas> = Object.freeze({
  desacuerdo: 10,
  empateTecnico: 2,
  metricaAlta: 80,
  factorDiscutido: 2,
  datosInciertos: 25,
});

/** A software's final metric and adoption level, input of the metric-versus-level flag. */
export interface MetricaNivel {
  metrica: number;
  nivel: NivelAdopcion;
}

const ORDEN_NIVEL: Readonly<Record<NivelAdopcion, number>> = { A: 1, B: 2, C: 3 };

function validarUmbral(valor: number, nombre: string, maximo = Number.POSITIVE_INFINITY): void {
  if (!Number.isFinite(valor) || valor < 0 || valor > maximo) {
    throw new RangeError(`${nombre} threshold must be between 0 and ${maximo}, got ${valor}`);
  }
}

function validarMetrica(valor: number): void {
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
    throw new RangeError(`Metric must be between 0 and 100, got ${valor}`);
  }
}

function rangoNivel(nivel: NivelAdopcion): number {
  const rango = ORDEN_NIVEL[nivel];
  if (rango === undefined) {
    throw new RangeError(`Unknown adoption level: ${String(nivel)}`);
  }
  return rango;
}

/**
 * RN-13. Disagreement: population deviation of the judges' scores > threshold.
 * Judges without score are skipped; fewer than 2 scores never flag.
 */
export function banderaDesacuerdo(
  scores: readonly (number | null)[],
  umbral: number = UMBRALES_BANDERAS_POR_DEFECTO.desacuerdo,
): boolean {
  validarUmbral(umbral, "Disagreement");
  const valores = scores.filter((s): s is number => s !== null);
  valores.forEach(validarMetrica);
  if (valores.length < 2) return false;
  return desviacionEstandarPoblacional(valores) > umbral;
}

/** RN-13. Technical tie: two final metrics differ by less than the threshold. */
export function banderaEmpateTecnico(
  metricaA: number,
  metricaB: number,
  umbral: number = UMBRALES_BANDERAS_POR_DEFECTO.empateTecnico,
): boolean {
  validarUmbral(umbral, "Technical tie", 100);
  validarMetrica(metricaA);
  validarMetrica(metricaB);
  return Math.abs(metricaA - metricaB) < umbral;
}

/** RN-13. Metric versus level: the software with the higher metric has the worse level. */
export function banderaMetricaContraNivel(a: MetricaNivel, b: MetricaNivel): boolean {
  validarMetrica(a.metrica);
  validarMetrica(b.metrica);
  const nivelA = rangoNivel(a.nivel);
  const nivelB = rangoNivel(b.nivel);
  if (a.metrica === b.metrica) return false;
  const [mayor, menor] = a.metrica > b.metrica ? [nivelA, nivelB] : [nivelB, nivelA];
  return mayor > menor;
}

/** RN-13. High metric with low level: metric >= threshold and level C. */
export function banderaMetricaAltaNivelBajo(
  metrica: number,
  nivel: NivelAdopcion,
  umbral: number = UMBRALES_BANDERAS_POR_DEFECTO.metricaAlta,
): boolean {
  validarUmbral(umbral, "High metric", 100);
  validarMetrica(metrica);
  return metrica >= umbral && rangoNivel(nivel) === ORDEN_NIVEL.C;
}

/**
 * RN-13. Discussed factor: range of the judges' PM >= threshold on a factor with IR >= 3.
 * Judges without PM are skipped; fewer than 2 PM never flag.
 */
export function banderaFactorDiscutido(
  pmJurados: readonly (number | null)[],
  ir: Importancia,
  umbral: number = UMBRALES_BANDERAS_POR_DEFECTO.factorDiscutido,
): boolean {
  validarUmbral(umbral, "Discussed factor", 3);
  validarImportancia(ir, "IR");
  const valores = pmJurados.filter((pm): pm is number => pm !== null);
  valores.forEach(validarPonderacionMedia);
  if (valores.length < 2 || ir < 3) return false;
  return Math.max(...valores) - Math.min(...valores) >= umbral;
}

/** RN-13. Uncertain data: more than the threshold percentage of a judge's answers are "Desconozco". */
export function banderaDatosInciertos(
  calificaciones: readonly Calificacion[],
  umbralPorcentaje: number = UMBRALES_BANDERAS_POR_DEFECTO.datosInciertos,
): boolean {
  validarUmbral(umbralPorcentaje, "Uncertain data", 100);
  if (calificaciones.length === 0) {
    throw new RangeError("At least one subfactor rating is required");
  }
  let desconozco = 0;
  for (const calificacion of calificaciones) {
    if (calificacion === DESCONOZCO) {
      desconozco += 1;
    } else if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 4) {
      throw new RangeError(`Rating must be 1 to 4 or "${DESCONOZCO}", got ${calificacion}`);
    }
  }
  return (100 * desconozco) / calificaciones.length > umbralPorcentaje;
}
