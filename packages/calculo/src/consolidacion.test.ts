import { describe, expect, it } from "vitest";
import {
  consolidarImportanciaDecisor,
  esRelevante,
  importanciaRelativa,
  type Importancia,
} from "./index.js";

describe("RN-05 consolidarImportanciaDecisor", () => {
  it("uses the median by default", () => {
    expect(consolidarImportanciaDecisor([1, 4, 4])).toBe(4);
    expect(consolidarImportanciaDecisor([3, 2, 4])).toBe(3);
  });

  it("rounds a .5 median down", () => {
    expect(consolidarImportanciaDecisor([2, 3])).toBe(2);
    expect(consolidarImportanciaDecisor([1, 2, 3, 4])).toBe(2);
  });

  it("uses the mean when the project chooses it, rounding down", () => {
    expect(consolidarImportanciaDecisor([3, 4, 4], "promedio")).toBe(3);
    expect(consolidarImportanciaDecisor([4, 4, 4], "promedio")).toBe(4);
    expect(consolidarImportanciaDecisor([1, 4, 4], "promedio")).toBe(3);
  });

  it("returns the single judge's value in single-judge mode", () => {
    expect(consolidarImportanciaDecisor([3])).toBe(3);
  });

  it("rejects no judges, values outside 1-4 and unknown methods", () => {
    expect(() => consolidarImportanciaDecisor([])).toThrow(RangeError);
    expect(() => consolidarImportanciaDecisor([2, 5 as Importancia])).toThrow(RangeError);
    expect(() =>
      consolidarImportanciaDecisor([2], "moda" as unknown as "mediana"),
    ).toThrow(RangeError);
  });
});

describe("RN-06 importanciaRelativa and esRelevante", () => {
  it("combines IS and consolidated ID with the importance matrix", () => {
    expect(importanciaRelativa(3, 1)).toBe(2);
    expect(importanciaRelativa(2, 1)).toBe(1);
    expect(importanciaRelativa(3, 4)).toBe(3);
  });

  it("marks a factor as relevant only when IR > 1", () => {
    expect(esRelevante(1)).toBe(false);
    expect(esRelevante(2)).toBe(true);
    expect(esRelevante(4)).toBe(true);
  });

  it("rejects IR outside 1-4", () => {
    expect(() => esRelevante(0 as Importancia)).toThrow(RangeError);
  });
});
