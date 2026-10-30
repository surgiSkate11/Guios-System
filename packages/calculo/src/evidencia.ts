// Evidence counting RN-14 and the IS estimation warnings of section 6.
import {
  IE_POR_DEFECTO,
  importanciaLiteratura,
  importanciaSugerida,
  respaldoPorSubfactor,
  type Cortes,
  type Importancia,
} from "./importancia.js";

/** Publication type of a piece of literature evidence. */
export type TipoPublicacion = "articulo_revisado" | "norma_tecnica" | "otro";

/** A piece of literature evidence and the subfactors it supports. */
export interface Evidencia {
  anio: number;
  tipo: TipoPublicacion;
  doi: string | null;
  subfactores: readonly number[];
  aceptada: boolean;
}

/** Citations per subfactor id and the factor total (TC). */
export interface ConteoEvidencia {
  citasPorSubfactor: Record<number, number>;
  totalCitas: number;
}

/** Literature period counted by RN-14, both ends included. */
export const PERIODO_EVIDENCIA = Object.freeze({ desde: 2020, hasta: 2025 });

export const AVISO_RESULTADO_SENSIBLE = "Resultado sensible: a una cita de cambiar de nivel";
export const AVISO_SIN_EVIDENCIA =
  "Sin evidencia encontrada; no encontrar no significa que no exista";

// Syntax of a DOI (prefix 10.<registrant>/<suffix>). Whether it resolves is checked
// by the server before the evidence is accepted (RNF-11).
const DOI = /^10\.\d{4,9}\/\S+$/;
const PREFIJO_DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:)/i;

function normalizarDoi(doi: string | null): string | null {
  if (doi === null) return null;
  const limpio = doi.trim().replace(PREFIJO_DOI, "").toLowerCase();
  return DOI.test(limpio) ? limpio : null;
}

function esIdValido(id: number): boolean {
  return Number.isInteger(id) && id > 0;
}

/**
 * RN-14. Evidence count of a factor. Only accepted peer-reviewed articles from 2020 to 2025
 * with a well-formed DOI count. An article adds one citation for each subfactor of the same
 * factor it supports; technical standards add nothing. A DOI counts once per subfactor.
 */
export function contarEvidencia(
  evidencias: readonly Evidencia[],
  subfactoresDelFactor: readonly number[],
): ConteoEvidencia {
  if (subfactoresDelFactor.length === 0) {
    throw new RangeError("The factor must have at least one subfactor");
  }
  if (!subfactoresDelFactor.every(esIdValido)) {
    throw new RangeError("Subfactor ids must be positive integers");
  }
  const doisPorSubfactor = new Map<number, Set<string>>(
    subfactoresDelFactor.map((id) => [id, new Set<string>()]),
  );
  if (doisPorSubfactor.size !== subfactoresDelFactor.length) {
    throw new RangeError("Subfactor ids must be unique");
  }

  for (const evidencia of evidencias) {
    if (!Number.isInteger(evidencia.anio)) {
      throw new RangeError(`Year must be an integer, got ${evidencia.anio}`);
    }
    const doi = normalizarDoi(evidencia.doi);
    const cuenta =
      evidencia.aceptada &&
      evidencia.tipo === "articulo_revisado" &&
      evidencia.anio >= PERIODO_EVIDENCIA.desde &&
      evidencia.anio <= PERIODO_EVIDENCIA.hasta &&
      doi !== null;
    if (!cuenta) continue;
    for (const id of evidencia.subfactores) {
      doisPorSubfactor.get(id)?.add(doi);
    }
  }

  const citasPorSubfactor: Record<number, number> = {};
  let totalCitas = 0;
  for (const [id, dois] of doisPorSubfactor) {
    citasPorSubfactor[id] = dois.size;
    totalCitas += dois.size;
  }
  return { citasPorSubfactor, totalCitas };
}

/** IS estimation of a factor with its section 6 warnings. */
export interface AvisosEstimacion {
  r: number;
  il: Importancia;
  is: Importancia;
  /** One citation more or less changes the IS. */
  resultadoSensible: boolean;
  /** TC = 0: the IS is still computed, but no evidence was found. */
  sinEvidencia: boolean;
}

/**
 * Section 6. Computes r, IL and IS for TC citations over NS subfactors and the warnings:
 * "Resultado sensible" when the IS changes with one citation more or one less, and
 * "Sin evidencia encontrada" when TC = 0.
 */
export function avisosEstimacion(
  totalCitas: number,
  numSubfactores: number,
  cortes: Readonly<Cortes>,
  ie: Importancia = IE_POR_DEFECTO,
): AvisosEstimacion {
  const isCon = (tc: number): Importancia =>
    importanciaSugerida(importanciaLiteratura(respaldoPorSubfactor(tc, numSubfactores), cortes), ie);
  const r = respaldoPorSubfactor(totalCitas, numSubfactores);
  const il = importanciaLiteratura(r, cortes);
  const is = importanciaSugerida(il, ie);
  const resultadoSensible =
    isCon(totalCitas + 1) !== is || (totalCitas > 0 && isCon(totalCitas - 1) !== is);
  return { r, il, is, resultadoSensible, sinEvidencia: totalCitas === 0 };
}
