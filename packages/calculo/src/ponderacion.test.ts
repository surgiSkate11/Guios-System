import { describe, expect, it } from "vitest";
import {
  DESCONOZCO,
  ponderacionMediaConsolidada,
  ponderacionMediaJurado,
  type Calificacion,
} from "./index.js";

describe("RN-07 ponderacionMediaJurado", () => {
  it("averages the subfactor ratings", () => {
    expect(ponderacionMediaJurado([1, 4])).toBe(2.5);
    expect(ponderacionMediaJurado([4, 4, 4])).toBe(4);
  });

  it("ignores 'Desconozco' answers", () => {
    expect(ponderacionMediaJurado([4, 3, DESCONOZCO, 2])).toBe(3);
  });

  it("returns null when every answer is 'Desconozco'", () => {
    expect(ponderacionMediaJurado([DESCONOZCO, DESCONOZCO])).toBeNull();
  });

  it("rejects an empty list and ratings outside 1-4", () => {
    expect(() => ponderacionMediaJurado([])).toThrow(RangeError);
    expect(() => ponderacionMediaJurado([3, 5 as Calificacion])).toThrow(RangeError);
    expect(() => ponderacionMediaJurado([0 as Calificacion])).toThrow(RangeError);
  });
});

describe("RN-08 ponderacionMediaConsolidada", () => {
  it("takes the median of the judges' PM", () => {
    expect(ponderacionMediaConsolidada([2.5, 3.5, 3])).toBe(3);
    expect(ponderacionMediaConsolidada([2, 3])).toBe(2.5);
  });

  it("does not round the result", () => {
    expect(ponderacionMediaConsolidada([2.25, 3.5])).toBe(2.875);
  });

  it("skips judges without PM", () => {
    expect(ponderacionMediaConsolidada([null, 3, 4])).toBe(3.5);
  });

  it("returns null when no judge has PM", () => {
    expect(ponderacionMediaConsolidada([null, null])).toBeNull();
    expect(ponderacionMediaConsolidada([])).toBeNull();
  });

  it("rejects PM outside 1.0-4.0", () => {
    expect(() => ponderacionMediaConsolidada([0.5, 3])).toThrow(RangeError);
    expect(() => ponderacionMediaConsolidada([4.1])).toThrow(RangeError);
  });
});
