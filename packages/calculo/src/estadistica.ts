// Basic statistics shared by the calculation rules.

function validarConjunto(valores: readonly number[]): void {
  if (valores.length === 0) {
    throw new RangeError("At least one value is required");
  }
  if (valores.some((v) => !Number.isFinite(v))) {
    throw new RangeError("Every value must be a finite number");
  }
}

/** Median: the middle value, or the mean of the two middle values for an even-sized set. */
export function mediana(valores: readonly number[]): number {
  validarConjunto(valores);
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) {
    return ordenados[medio]!;
  }
  return (ordenados[medio - 1]! + ordenados[medio]!) / 2;
}

/** Arithmetic mean. */
export function promedio(valores: readonly number[]): number {
  validarConjunto(valores);
  return valores.reduce((suma, v) => suma + v, 0) / valores.length;
}
