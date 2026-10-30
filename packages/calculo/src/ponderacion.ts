// Mean weighting rules RN-07 and RN-08.
import { mediana, promedio } from "./estadistica.js";

/** "I don't know" answer: it carries no value and is excluded from the PM. */
export const DESCONOZCO = "desconozco";

/** Subfactor rating: 1 Does not meet ... 4 Meets, or "Desconozco". */
export type Calificacion = 1 | 2 | 3 | 4 | typeof DESCONOZCO;

const PM_MINIMA = 1;
const PM_MAXIMA = 4;

/**
 * RN-07. Judge's mean weighting (PM) of a factor: mean of the subfactor ratings,
 * excluding "Desconozco". Returns null when every answer is "Desconozco"; that factor
 * then does not enter the judge's metric (team proposal).
 */
export function ponderacionMediaJurado(calificaciones: readonly Calificacion[]): number | null {
  if (calificaciones.length === 0) {
    throw new RangeError("At least one subfactor rating is required");
  }
  const valores: number[] = [];
  for (const calificacion of calificaciones) {
    if (calificacion === DESCONOZCO) continue;
    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 4) {
      throw new RangeError(`Rating must be 1 to 4 or "${DESCONOZCO}", got ${calificacion}`);
    }
    valores.push(calificacion);
  }
  return valores.length === 0 ? null : promedio(valores);
}

/**
 * RN-08. Consolidated PM of a factor for one software: median of the judges' PM.
 * Judges without PM are skipped; returns null when no judge has PM.
 */
export function ponderacionMediaConsolidada(pmJurados: readonly (number | null)[]): number | null {
  const valores = pmJurados.filter((pm): pm is number => pm !== null);
  for (const pm of valores) {
    if (!Number.isFinite(pm) || pm < PM_MINIMA || pm > PM_MAXIMA) {
      throw new RangeError(`PM must be between ${PM_MINIMA} and ${PM_MAXIMA}, got ${pm}`);
    }
  }
  return valores.length === 0 ? null : mediana(valores);
}
