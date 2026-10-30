import { describe, expect, it } from "vitest";
import { mediana, promedio } from "./index.js";

describe("mediana", () => {
  it("returns the middle value of an odd-sized set regardless of order", () => {
    expect(mediana([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values of an even-sized set", () => {
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
  });

  it("does not mutate the input", () => {
    const valores = [3, 1, 2];
    mediana(valores);
    expect(valores).toEqual([3, 1, 2]);
  });

  it("rejects an empty set or non-finite values", () => {
    expect(() => mediana([])).toThrow(RangeError);
    expect(() => mediana([1, Number.NaN])).toThrow(RangeError);
  });
});

describe("promedio", () => {
  it("returns the arithmetic mean", () => {
    expect(promedio([1, 2, 3, 4])).toBe(2.5);
  });

  it("rejects an empty set or non-finite values", () => {
    expect(() => promedio([])).toThrow(RangeError);
    expect(() => promedio([1, Number.POSITIVE_INFINITY])).toThrow(RangeError);
  });
});
