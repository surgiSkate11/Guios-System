import { describe, expect, it } from "vitest";
import {
  DESCONOZCO,
  UMBRALES_BANDERAS_POR_DEFECTO,
  banderaDatosInciertos,
  banderaDesacuerdo,
  banderaEmpateTecnico,
  banderaFactorDiscutido,
  banderaMetricaAltaNivelBajo,
  banderaMetricaContraNivel,
  type Calificacion,
} from "./index.js";

describe("RN-13 default thresholds (Configuración screen)", () => {
  it("uses 10, 2, 80, 2 and 25 %", () => {
    expect(UMBRALES_BANDERAS_POR_DEFECTO).toEqual({
      desacuerdo: 10,
      empateTecnico: 2,
      metricaAlta: 80,
      factorDiscutido: 2,
      datosInciertos: 25,
    });
    expect(Object.isFrozen(UMBRALES_BANDERAS_POR_DEFECTO)).toBe(true);
  });
});

describe("RN-13 banderaDesacuerdo (deviation > threshold)", () => {
  it("flags when the population deviation of the judges' scores exceeds 10", () => {
    // Deviation of [50, 72] is 11.
    expect(banderaDesacuerdo([50, 72])).toBe(true);
  });

  it("does not flag when the deviation is exactly the threshold", () => {
    // Deviation of [50, 70] is 10.
    expect(banderaDesacuerdo([50, 70])).toBe(false);
    expect(banderaDesacuerdo([60, 62, 61])).toBe(false);
  });

  it("requires 2 or more judges with score", () => {
    expect(banderaDesacuerdo([10])).toBe(false);
    expect(banderaDesacuerdo([10, null])).toBe(false);
    expect(banderaDesacuerdo([])).toBe(false);
  });

  it("accepts a custom threshold", () => {
    expect(banderaDesacuerdo([50, 70], 9.5)).toBe(true);
  });

  it.each([
    [[50, 101], 10],
    [[-1, 50], 10],
    [[50, 70], -1],
    [[50, 70], Number.NaN],
  ])("rejects invalid input scores=%j umbral=%s", (scores, umbral) => {
    expect(() => banderaDesacuerdo(scores, umbral)).toThrow(RangeError);
  });
});

describe("RN-13 banderaEmpateTecnico (difference < threshold)", () => {
  it("flags metrics closer than 2 points", () => {
    expect(banderaEmpateTecnico(72.3, 70.4)).toBe(true);
    expect(banderaEmpateTecnico(70, 70)).toBe(true);
  });

  it("does not flag a difference of exactly 2 or more", () => {
    expect(banderaEmpateTecnico(72, 70)).toBe(false);
    expect(banderaEmpateTecnico(70, 75)).toBe(false);
  });

  it("accepts a custom threshold", () => {
    expect(banderaEmpateTecnico(72, 70, 2.5)).toBe(true);
  });

  it.each([
    [101, 70, 2],
    [70, -0.1, 2],
    [70, 71, -1],
  ])("rejects invalid input a=%s b=%s umbral=%s", (a, b, umbral) => {
    expect(() => banderaEmpateTecnico(a, b, umbral)).toThrow(RangeError);
  });
});

describe("RN-13 banderaMetricaContraNivel (higher metric with worse level)", () => {
  it("flags the reference project: A 72.3 with level C against B 70.0 with level B", () => {
    expect(
      banderaMetricaContraNivel({ metrica: 72.3, nivel: "C" }, { metrica: 70, nivel: "B" }),
    ).toBe(true);
  });

  it("is symmetric", () => {
    expect(
      banderaMetricaContraNivel({ metrica: 70, nivel: "B" }, { metrica: 72.3, nivel: "C" }),
    ).toBe(true);
  });

  it("does not flag when the higher metric has the same or a better level", () => {
    expect(
      banderaMetricaContraNivel({ metrica: 80, nivel: "A" }, { metrica: 70, nivel: "B" }),
    ).toBe(false);
    expect(
      banderaMetricaContraNivel({ metrica: 80, nivel: "B" }, { metrica: 70, nivel: "B" }),
    ).toBe(false);
  });

  it("does not flag equal metrics", () => {
    expect(
      banderaMetricaContraNivel({ metrica: 70, nivel: "C" }, { metrica: 70, nivel: "A" }),
    ).toBe(false);
  });

  it("rejects an invalid metric or level", () => {
    expect(() =>
      banderaMetricaContraNivel({ metrica: 120, nivel: "A" }, { metrica: 70, nivel: "B" }),
    ).toThrow(RangeError);
    expect(() =>
      banderaMetricaContraNivel(
        { metrica: 80, nivel: "D" as never },
        { metrica: 70, nivel: "B" },
      ),
    ).toThrow(RangeError);
  });
});

describe("RN-13 banderaMetricaAltaNivelBajo (metric >= 80 and level C)", () => {
  it("flags a metric of exactly 80 with level C", () => {
    expect(banderaMetricaAltaNivelBajo(80, "C")).toBe(true);
    expect(banderaMetricaAltaNivelBajo(95, "C")).toBe(true);
  });

  it("does not flag below 80 or with level A or B", () => {
    expect(banderaMetricaAltaNivelBajo(79.99, "C")).toBe(false);
    expect(banderaMetricaAltaNivelBajo(90, "B")).toBe(false);
    expect(banderaMetricaAltaNivelBajo(90, "A")).toBe(false);
  });

  it("accepts a custom threshold", () => {
    expect(banderaMetricaAltaNivelBajo(75, "C", 75)).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(() => banderaMetricaAltaNivelBajo(-1, "C")).toThrow(RangeError);
    expect(() => banderaMetricaAltaNivelBajo(80, "C", 101)).toThrow(RangeError);
    expect(() => banderaMetricaAltaNivelBajo(80, "X" as never)).toThrow(RangeError);
  });
});

describe("RN-13 banderaFactorDiscutido (PM range >= 2 with IR >= 3)", () => {
  it("flags a PM range of exactly 2 on a factor with IR 3 or 4", () => {
    expect(banderaFactorDiscutido([1.5, 3.5], 3)).toBe(true);
    expect(banderaFactorDiscutido([1, 2, 4], 4)).toBe(true);
  });

  it("does not flag a range below 2", () => {
    expect(banderaFactorDiscutido([2, 3.99], 4)).toBe(false);
  });

  it("does not flag factors with IR below 3", () => {
    expect(banderaFactorDiscutido([1, 4], 2)).toBe(false);
    expect(banderaFactorDiscutido([1, 4], 1)).toBe(false);
  });

  it("requires 2 or more judges with PM", () => {
    expect(banderaFactorDiscutido([1, null], 4)).toBe(false);
    expect(banderaFactorDiscutido([4], 4)).toBe(false);
  });

  it("accepts a custom threshold", () => {
    expect(banderaFactorDiscutido([2, 3.5], 3, 1.5)).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(() => banderaFactorDiscutido([0.5, 3], 3)).toThrow(RangeError);
    expect(() => banderaFactorDiscutido([1, 3], 5 as never)).toThrow(RangeError);
    expect(() => banderaFactorDiscutido([1, 3], 3, -1)).toThrow(RangeError);
  });
});

describe("RN-13 banderaDatosInciertos (> 25 % of Desconozco from a judge)", () => {
  const respuestas = (desconozco: number, total: number): Calificacion[] =>
    Array.from({ length: total }, (_, i) => (i < desconozco ? DESCONOZCO : 3));

  it("flags more than 25 % of Desconozco", () => {
    expect(banderaDatosInciertos(respuestas(2, 7))).toBe(true);
    expect(banderaDatosInciertos(respuestas(4, 4))).toBe(true);
  });

  it("does not flag exactly 25 % or less", () => {
    expect(banderaDatosInciertos(respuestas(1, 4))).toBe(false);
    expect(banderaDatosInciertos(respuestas(0, 4))).toBe(false);
  });

  it("works with a single judge", () => {
    expect(banderaDatosInciertos([DESCONOZCO])).toBe(true);
  });

  it("accepts a custom percentage", () => {
    expect(banderaDatosInciertos(respuestas(1, 4), 20)).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(() => banderaDatosInciertos([])).toThrow(RangeError);
    expect(() => banderaDatosInciertos([5 as never])).toThrow(RangeError);
    expect(() => banderaDatosInciertos(respuestas(1, 4), 101)).toThrow(RangeError);
  });
});
