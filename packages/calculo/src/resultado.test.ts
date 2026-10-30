import { describe, expect, it } from "vitest";
import {
  UMBRAL_FODA_POR_DEFECTO,
  clasificarFoda,
  metricaFinal,
  metricaJurado,
  nivelAdopcion,
  type Alcance,
  type Importancia,
} from "./index.js";

describe("RN-09 clasificarFoda", () => {
  it("uses a default threshold of 3", () => {
    expect(UMBRAL_FODA_POR_DEFECTO).toBe(3);
  });

  it("classifies internal factors as strength or weakness", () => {
    expect(clasificarFoda("interno", 3)).toBe("fortaleza");
    expect(clasificarFoda("interno", 4)).toBe("fortaleza");
    expect(clasificarFoda("interno", 2.99)).toBe("debilidad");
  });

  it("classifies external factors as opportunity or threat", () => {
    expect(clasificarFoda("externo", 3)).toBe("oportunidad");
    expect(clasificarFoda("externo", 2.5)).toBe("amenaza");
  });

  it("accepts a custom threshold", () => {
    expect(clasificarFoda("interno", 2.5, 2.3)).toBe("fortaleza");
    expect(clasificarFoda("externo", 2.2, 2.3)).toBe("amenaza");
  });

  it("rejects PM outside 1-4, invalid thresholds and unknown scopes", () => {
    expect(() => clasificarFoda("interno", 0.9)).toThrow(RangeError);
    expect(() => clasificarFoda("interno", 4.1)).toThrow(RangeError);
    expect(() => clasificarFoda("interno", 3, 0.5)).toThrow(RangeError);
    expect(() => clasificarFoda("mixto" as Alcance, 3)).toThrow(RangeError);
  });
});

describe("RN-10 nivelAdopcion", () => {
  it("gives A when every relevant factor is a strength or opportunity", () => {
    expect(
      nivelAdopcion([
        { ir: 3, foda: "fortaleza" },
        { ir: 2, foda: "oportunidad" },
      ]),
    ).toBe("A");
  });

  it("gives B when weaknesses or threats appear only in factors with IR 2", () => {
    expect(
      nivelAdopcion([
        { ir: 4, foda: "fortaleza" },
        { ir: 2, foda: "debilidad" },
        { ir: 2, foda: "amenaza" },
      ]),
    ).toBe("B");
  });

  it("gives C when a weakness or threat appears in a factor with IR 3 or 4", () => {
    expect(
      nivelAdopcion([
        { ir: 2, foda: "fortaleza" },
        { ir: 3, foda: "amenaza" },
      ]),
    ).toBe("C");
    expect(nivelAdopcion([{ ir: 4, foda: "debilidad" }])).toBe("C");
  });

  it("ignores factors that are not relevant (IR 1)", () => {
    expect(
      nivelAdopcion([
        { ir: 1, foda: "debilidad" },
        { ir: 2, foda: "fortaleza" },
      ]),
    ).toBe("A");
  });

  it("rejects a set without relevant factors", () => {
    expect(() => nivelAdopcion([])).toThrow(RangeError);
    expect(() => nivelAdopcion([{ ir: 1, foda: "fortaleza" }])).toThrow(RangeError);
  });
});

describe("RN-11 metricaJurado", () => {
  it("weights (PM - 1) / 3 by IR over relevant factors", () => {
    // (3 * 1 + 2 * 0.5) / (3 + 2) * 100 = 80
    expect(
      metricaJurado([
        { ir: 3, pm: 4 },
        { ir: 2, pm: 2.5 },
      ]),
    ).toBeCloseTo(80, 10);
  });

  it("gives 0 when every PM is 1 and 100 when every PM is 4", () => {
    expect(metricaJurado([{ ir: 2, pm: 1 }])).toBe(0);
    expect(metricaJurado([{ ir: 4, pm: 4 }])).toBe(100);
  });

  it("skips factors without PM and factors that are not relevant", () => {
    expect(
      metricaJurado([
        { ir: 3, pm: 4 },
        { ir: 4, pm: null },
        { ir: 1, pm: 1 },
      ]),
    ).toBe(100);
  });

  it("returns null when no relevant factor has PM", () => {
    expect(metricaJurado([{ ir: 3, pm: null }])).toBeNull();
    expect(metricaJurado([])).toBeNull();
  });

  it("rejects PM outside 1-4 and IR outside 1-4", () => {
    expect(() => metricaJurado([{ ir: 2, pm: 5 }])).toThrow(RangeError);
    expect(() => metricaJurado([{ ir: 5 as Importancia, pm: 3 }])).toThrow(RangeError);
  });
});

describe("RN-12 metricaFinal", () => {
  it("uses the median by default and reports min, max and population deviation", () => {
    const resultado = metricaFinal([60, 70, 80]);
    expect(resultado).not.toBeNull();
    expect(resultado!.final).toBe(70);
    expect(resultado!.minimo).toBe(60);
    expect(resultado!.maximo).toBe(80);
    // Population standard deviation: sqrt(((-10)^2 + 0 + 10^2) / 3)
    expect(resultado!.desviacion).toBeCloseTo(Math.sqrt(200 / 3), 10);
  });

  it("uses the mean when the project chooses it", () => {
    expect(metricaFinal([60, 70, 100], "promedio")!.final).toBeCloseTo(76.6667, 4);
  });

  it("gives deviation 0 in single-judge mode", () => {
    expect(metricaFinal([72.3])).toEqual({ final: 72.3, minimo: 72.3, maximo: 72.3, desviacion: 0 });
  });

  it("skips judges without score and returns null when none has one", () => {
    expect(metricaFinal([null, 50, 70])!.final).toBe(60);
    expect(metricaFinal([null])).toBeNull();
    expect(metricaFinal([])).toBeNull();
  });

  it("rejects scores outside 0-100", () => {
    expect(() => metricaFinal([-1])).toThrow(RangeError);
    expect(() => metricaFinal([100.5])).toThrow(RangeError);
  });
});
