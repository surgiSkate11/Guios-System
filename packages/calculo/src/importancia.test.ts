import { describe, expect, it } from "vitest";
import {
  CORTES_2020_2025,
  CORTES_TESIS,
  cuartilesInclusivos,
  importanciaLiteratura,
  importanciaSugerida,
  matrizImportancia,
  respaldoPorSubfactor,
  type Importancia,
} from "./index.js";

// Reference anchors from the specification, section 6 (illustrative values).
const ANCLAS = [
  { factor: "Usabilidad", citas: 9, ns: 4 },
  { factor: "Compatibilidad", citas: 17, ns: 8 },
  { factor: "Documentación", citas: 23, ns: 11 },
  { factor: "Fiabilidad", citas: 12, ns: 6 },
  { factor: "Coste total de propiedad", citas: 4, ns: 2 },
  { factor: "Soporte", citas: 10, ns: 6 },
  { factor: "Formación", citas: 5, ns: 4 },
  { factor: "Prueba", citas: 1, ns: 1 },
];
const R_ANCLAS = ANCLAS.map((a) => respaldoPorSubfactor(a.citas, a.ns));

describe("RN-01 respaldoPorSubfactor (r = TC / NS)", () => {
  it("divides total citations by number of subfactors", () => {
    expect(respaldoPorSubfactor(23, 11)).toBeCloseTo(2.09, 2);
    expect(respaldoPorSubfactor(27, 12)).toBe(2.25);
  });

  it("returns 0 when the factor has no citations", () => {
    expect(respaldoPorSubfactor(0, 3)).toBe(0);
  });

  it.each([
    [10, 0],
    [10, -1],
    [10, 1.5],
    [-1, 3],
    [2.5, 3],
    [Number.NaN, 3],
  ])("rejects invalid input TC=%s NS=%s", (tc, ns) => {
    expect(() => respaldoPorSubfactor(tc, ns)).toThrow(RangeError);
  });
});

describe("cuartilesInclusivos (Excel QUARTILE.INC)", () => {
  it("matches QUARTILE.INC on a simple set", () => {
    expect(cuartilesInclusivos([1, 2, 3, 4])).toEqual({ rq1: 1.75, rq2: 2.5, rq3: 3.25 });
  });

  it("reproduces the anchor spread of the specification example", () => {
    const cortes = cuartilesInclusivos(R_ANCLAS);
    expect(cortes.rq1).toBeCloseTo(1.56, 2);
    expect(cortes.rq2).toBeCloseTo(2.0, 10);
    expect(cortes.rq3).toBeCloseTo(2.1, 2);
  });

  it("does not depend on input order and does not mutate the input", () => {
    const valores = [4, 1, 3, 2];
    expect(cuartilesInclusivos(valores)).toEqual({ rq1: 1.75, rq2: 2.5, rq3: 3.25 });
    expect(valores).toEqual([4, 1, 3, 2]);
  });

  it("returns the single value for a one-element set", () => {
    expect(cuartilesInclusivos([5])).toEqual({ rq1: 5, rq2: 5, rq3: 5 });
  });

  it("rejects an empty set or non-finite values", () => {
    expect(() => cuartilesInclusivos([])).toThrow(RangeError);
    expect(() => cuartilesInclusivos([1, Number.NaN])).toThrow(RangeError);
  });
});

describe("RN-02 importanciaLiteratura (IL by quartiles)", () => {
  it("assigns ties to the lower quartile with the thesis cut points", () => {
    expect(importanciaLiteratura(1.86, CORTES_TESIS)).toBe(1);
    expect(importanciaLiteratura(1.87, CORTES_TESIS)).toBe(2);
    expect(importanciaLiteratura(3.65, CORTES_TESIS)).toBe(2);
    expect(importanciaLiteratura(3.66, CORTES_TESIS)).toBe(3);
    expect(importanciaLiteratura(4.78, CORTES_TESIS)).toBe(3);
    expect(importanciaLiteratura(4.79, CORTES_TESIS)).toBe(4);
  });

  it("uses the 2020-2025 base cut points", () => {
    expect(CORTES_2020_2025).toEqual({ rq1: 0, rq2: 0.58, rq3: 1.35 });
    expect(importanciaLiteratura(0, CORTES_2020_2025)).toBe(1);
    expect(importanciaLiteratura(0.58, CORTES_2020_2025)).toBe(2);
    expect(importanciaLiteratura(1.36, CORTES_2020_2025)).toBe(4);
  });

  it("rejects negative r and unordered cut points", () => {
    expect(() => importanciaLiteratura(-0.1, CORTES_TESIS)).toThrow(RangeError);
    expect(() => importanciaLiteratura(1, { rq1: 2, rq2: 1, rq3: 3 })).toThrow(RangeError);
  });
});

describe("RN-03 matrizImportancia (thesis Fig. 5.10)", () => {
  const TABLA: Importancia[][] = [
    [1, 1, 2, 2],
    [1, 2, 2, 3],
    [2, 2, 3, 3],
    [2, 3, 3, 4],
  ];

  it("reproduces every cell of the matrix", () => {
    for (const a of [1, 2, 3, 4] as const) {
      for (const b of [1, 2, 3, 4] as const) {
        expect(matrizImportancia(a, b)).toBe(TABLA[a - 1]![b - 1]);
      }
    }
  });

  it.each([
    [0, 2],
    [5, 2],
    [2, 2.5],
  ])("rejects importance values outside 1-4: %s, %s", (a, b) => {
    expect(() => matrizImportancia(a as Importancia, b as Importancia)).toThrow(RangeError);
  });
});

describe("RN-04 importanciaSugerida (IS = matriz(IE, IL))", () => {
  it("with IE = 3, IL 1 or 2 gives IS 2 and IL 3 or 4 gives IS 3", () => {
    expect(importanciaSugerida(1)).toBe(2);
    expect(importanciaSugerida(2)).toBe(2);
    expect(importanciaSugerida(3)).toBe(3);
    expect(importanciaSugerida(4)).toBe(3);
  });

  it("accepts an explicit IE", () => {
    expect(importanciaSugerida(4, 4)).toBe(4);
  });
});

describe("Specification example: new factor against the anchors", () => {
  const cortes = cuartilesInclusivos(R_ANCLAS);

  it("7 citations in 3 subfactors gives IL 4 and IS 3", () => {
    const il = importanciaLiteratura(respaldoPorSubfactor(7, 3), cortes);
    expect(il).toBe(4);
    expect(importanciaSugerida(il)).toBe(3);
  });

  it("6 citations in 3 subfactors gives IL 2 and IS 2", () => {
    const il = importanciaLiteratura(respaldoPorSubfactor(6, 3), cortes);
    expect(il).toBe(2);
    expect(importanciaSugerida(il)).toBe(2);
  });

  it("no citations gives IL 1 and IS 2", () => {
    const il = importanciaLiteratura(respaldoPorSubfactor(0, 3), cortes);
    expect(il).toBe(1);
    expect(importanciaSugerida(il)).toBe(2);
  });
});
