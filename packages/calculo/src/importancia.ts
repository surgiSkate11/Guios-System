// Importance rules RN-01 to RN-04 (thesis Rea Sánchez 2022, eq. 5.1, 5.2 and Fig. 5.10).

/** Importance scale: 1 Irrelevant, 2 Optional, 3 Important, 4 Fundamental. */
export type Importancia = 1 | 2 | 3 | 4;

/** Quartile cut points of the r values used to assign IL. */
export interface Cortes {
  rq1: number;
  rq2: number;
  rq3: number;
}

/** Expert importance (IE): the expert survey is not repeated, so it stays at 3. */
export const IE_POR_DEFECTO: Importancia = 3;

/** Current cut points from the thesis. */
export const CORTES_TESIS: Readonly<Cortes> = Object.freeze({ rq1: 1.86, rq2: 3.65, rq3: 4.78 });

/** Current cut points from the 2020-2025 literature base. */
export const CORTES_2020_2025: Readonly<Cortes> = Object.freeze({ rq1: 0, rq2: 0.58, rq3: 1.35 });

function esEnteroNoNegativo(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 0;
}

/** Throws a RangeError unless the value is an integer importance from 1 to 4. */
export function validarImportancia(valor: number, nombre: string): asserts valor is Importancia {
  if (!Number.isInteger(valor) || valor < 1 || valor > 4) {
    throw new RangeError(`${nombre} must be an integer from 1 to 4, got ${valor}`);
  }
}

/**
 * RN-01. Support per subfactor: r = TC / NS.
 * @param totalCitas TC, citations of the factor (non-negative integer).
 * @param numSubfactores NS, number of subfactors of the factor (positive integer).
 */
export function respaldoPorSubfactor(totalCitas: number, numSubfactores: number): number {
  if (!esEnteroNoNegativo(totalCitas)) {
    throw new RangeError(`TC must be a non-negative integer, got ${totalCitas}`);
  }
  if (!esEnteroNoNegativo(numSubfactores) || numSubfactores === 0) {
    throw new RangeError(`NS must be a positive integer, got ${numSubfactores}`);
  }
  return totalCitas / numSubfactores;
}

/**
 * Inclusive quartiles, equivalent to Excel QUARTILE.INC: linear interpolation
 * at position (n - 1) * p over the sorted values.
 */
export function cuartilesInclusivos(valores: readonly number[]): Cortes {
  if (valores.length === 0) {
    throw new RangeError("At least one value is required to compute quartiles");
  }
  if (valores.some((v) => !Number.isFinite(v))) {
    throw new RangeError("Every value must be a finite number");
  }
  const ordenados = [...valores].sort((a, b) => a - b);
  const percentil = (p: number): number => {
    const posicion = (ordenados.length - 1) * p;
    const inferior = Math.floor(posicion);
    const fraccion = posicion - inferior;
    const base = ordenados[inferior]!;
    const siguiente = ordenados[Math.min(inferior + 1, ordenados.length - 1)]!;
    return base + fraccion * (siguiente - base);
  };
  return { rq1: percentil(0.25), rq2: percentil(0.5), rq3: percentil(0.75) };
}

/**
 * RN-02. Literature importance (IL) by quartiles. A tie falls into the lower quartile:
 * IL = 1 if r <= rq1; 2 if r <= rq2; 3 if r <= rq3; 4 otherwise.
 */
export function importanciaLiteratura(r: number, cortes: Readonly<Cortes>): Importancia {
  if (!Number.isFinite(r) || r < 0) {
    throw new RangeError(`r must be a non-negative number, got ${r}`);
  }
  const { rq1, rq2, rq3 } = cortes;
  if (!(rq1 <= rq2 && rq2 <= rq3)) {
    throw new RangeError(`Cut points must satisfy rq1 <= rq2 <= rq3, got ${rq1}, ${rq2}, ${rq3}`);
  }
  if (r <= rq1) return 1;
  if (r <= rq2) return 2;
  if (r <= rq3) return 3;
  return 4;
}

/**
 * RN-03. Importance matrix: combines two importances from 1 to 4.
 * Equivalent to averaging them and rounding down.
 */
export function matrizImportancia(a: Importancia, b: Importancia): Importancia {
  validarImportancia(a, "a");
  validarImportancia(b, "b");
  return Math.floor((a + b) / 2) as Importancia;
}

/** RN-04. Suggested importance: IS = matriz(IE, IL). */
export function importanciaSugerida(
  il: Importancia,
  ie: Importancia = IE_POR_DEFECTO,
): Importancia {
  return matrizImportancia(ie, il);
}
