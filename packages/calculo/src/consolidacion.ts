// Consolidation rules RN-05 and RN-06.
import { mediana, promedio } from "./estadistica.js";
import { matrizImportancia, validarImportancia, type Importancia } from "./importancia.js";

/** How the judges' answers are consolidated in a project. */
export type MetodoConsolidacion = "mediana" | "promedio";

/**
 * RN-05. Consolidated decision-maker importance (ID).
 * Median of the judges' ID by default, or mean if the project chooses it.
 * A fractional result is rounded down (team proposal; pending confirmation).
 */
export function consolidarImportanciaDecisor(
  importancias: readonly Importancia[],
  metodo: MetodoConsolidacion = "mediana",
): Importancia {
  if (importancias.length === 0) {
    throw new RangeError("At least one judge importance is required");
  }
  importancias.forEach((valor) => validarImportancia(valor, "ID"));
  let valor: number;
  if (metodo === "mediana") {
    valor = mediana(importancias);
  } else if (metodo === "promedio") {
    valor = promedio(importancias);
  } else {
    throw new RangeError(`Unknown consolidation method: ${String(metodo)}`);
  }
  return Math.floor(valor) as Importancia;
}

/** RN-06. Relative importance: IR = matriz(IS, consolidated ID). */
export function importanciaRelativa(
  importanciaSugerida: Importancia,
  idConsolidada: Importancia,
): Importancia {
  return matrizImportancia(importanciaSugerida, idConsolidada);
}

/** RN-06. A factor is relevant when IR > 1. */
export function esRelevante(ir: Importancia): boolean {
  validarImportancia(ir, "IR");
  return ir > 1;
}
