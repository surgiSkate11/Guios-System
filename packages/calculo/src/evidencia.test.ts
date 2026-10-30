import { describe, expect, it } from "vitest";
import {
  AVISO_RESULTADO_SENSIBLE,
  AVISO_SIN_EVIDENCIA,
  PERIODO_EVIDENCIA,
  avisosEstimacion,
  contarEvidencia,
  cuartilesInclusivos,
  respaldoPorSubfactor,
  type Evidencia,
} from "./index.js";

const SUBFACTORES = [11, 12, 13];

function evidencia(parcial: Partial<Evidencia> = {}): Evidencia {
  return {
    anio: 2023,
    tipo: "articulo_revisado",
    doi: "10.1000/abc123",
    subfactores: [11],
    aceptada: true,
    ...parcial,
  };
}

describe("RN-14 contarEvidencia", () => {
  it("uses the 2020 to 2025 period", () => {
    expect(PERIODO_EVIDENCIA).toEqual({ desde: 2020, hasta: 2025 });
  });

  it("returns zero citations for every subfactor when there is no evidence", () => {
    expect(contarEvidencia([], SUBFACTORES)).toEqual({
      citasPorSubfactor: { 11: 0, 12: 0, 13: 0 },
      totalCitas: 0,
    });
  });

  it("adds one citation per subfactor of the same factor that an article supports", () => {
    const resultado = contarEvidencia(
      [
        evidencia({ doi: "10.1000/a", subfactores: [11, 12] }),
        evidencia({ doi: "10.1000/b", subfactores: [12] }),
      ],
      SUBFACTORES,
    );
    expect(resultado).toEqual({ citasPorSubfactor: { 11: 1, 12: 2, 13: 0 }, totalCitas: 3 });
  });

  it("ignores subfactors that belong to another factor", () => {
    const resultado = contarEvidencia([evidencia({ subfactores: [11, 99] })], SUBFACTORES);
    expect(resultado.citasPorSubfactor).toEqual({ 11: 1, 12: 0, 13: 0 });
    expect(resultado.totalCitas).toBe(1);
  });

  it("counts only the 2020 to 2025 period, both ends included", () => {
    const resultado = contarEvidencia(
      [
        evidencia({ doi: "10.1000/a", anio: 2019 }),
        evidencia({ doi: "10.1000/b", anio: 2020 }),
        evidencia({ doi: "10.1000/c", anio: 2025 }),
        evidencia({ doi: "10.1000/d", anio: 2026 }),
      ],
      SUBFACTORES,
    );
    expect(resultado.totalCitas).toBe(2);
  });

  it("does not count technical standards or other non peer-reviewed publications", () => {
    const resultado = contarEvidencia(
      [
        evidencia({ doi: "10.1000/a", tipo: "norma_tecnica" }),
        evidencia({ doi: "10.1000/b", tipo: "otro" }),
      ],
      SUBFACTORES,
    );
    expect(resultado.totalCitas).toBe(0);
  });

  it("does not count articles without a well-formed DOI", () => {
    const resultado = contarEvidencia(
      [
        evidencia({ doi: null }),
        evidencia({ doi: "" }),
        evidencia({ doi: "not-a-doi" }),
        evidencia({ doi: "11.1000/abc" }),
      ],
      SUBFACTORES,
    );
    expect(resultado.totalCitas).toBe(0);
  });

  it("does not count rejected evidence", () => {
    expect(contarEvidencia([evidencia({ aceptada: false })], SUBFACTORES).totalCitas).toBe(0);
  });

  it("counts the same DOI once per subfactor, whatever its spelling", () => {
    const resultado = contarEvidencia(
      [
        evidencia({ doi: "10.1000/ABC", subfactores: [11, 11] }),
        evidencia({ doi: "https://doi.org/10.1000/abc", subfactores: [11, 12] }),
      ],
      SUBFACTORES,
    );
    expect(resultado.citasPorSubfactor).toEqual({ 11: 1, 12: 1, 13: 0 });
    expect(resultado.totalCitas).toBe(2);
  });

  it("rejects a factor without subfactors or with invalid subfactor ids", () => {
    expect(() => contarEvidencia([], [])).toThrow(RangeError);
    expect(() => contarEvidencia([], [1, 1])).toThrow(RangeError);
    expect(() => contarEvidencia([], [0])).toThrow(RangeError);
    expect(() => contarEvidencia([], [1.5])).toThrow(RangeError);
  });

  it("rejects evidence with an invalid year", () => {
    expect(() => contarEvidencia([evidencia({ anio: 2023.5 })], SUBFACTORES)).toThrow(RangeError);
  });
});

describe("Section 6 avisosEstimacion", () => {
  // Anchors of the specification example: rq1 1.56, rq2 2.00, rq3 2.10.
  const CORTES = cuartilesInclusivos(
    [
      [9, 4],
      [17, 8],
      [23, 11],
      [12, 6],
      [4, 2],
      [10, 6],
      [5, 4],
      [1, 1],
    ].map(([tc, ns]) => respaldoPorSubfactor(tc!, ns!)),
  );

  it("exposes the exact warning texts", () => {
    expect(AVISO_RESULTADO_SENSIBLE).toBe("Resultado sensible: a una cita de cambiar de nivel");
    expect(AVISO_SIN_EVIDENCIA).toBe(
      "Sin evidencia encontrada; no encontrar no significa que no exista",
    );
  });

  it("HU-22: 7 citations over 3 subfactors gives r 2.33, IL 4 and IS 3, one citation from changing", () => {
    expect(avisosEstimacion(7, 3, CORTES)).toEqual({
      r: 7 / 3,
      il: 4,
      is: 3,
      resultadoSensible: true,
      sinEvidencia: false,
    });
  });

  it("HU-23: 6 citations gives r 2.00, IL 2 and IS 2 with the sensitive warning", () => {
    expect(avisosEstimacion(6, 3, CORTES)).toEqual({
      r: 2,
      il: 2,
      is: 2,
      resultadoSensible: true,
      sinEvidencia: false,
    });
  });

  it("is not sensitive when one citation more or less keeps the IS", () => {
    expect(avisosEstimacion(1, 1, CORTES)).toMatchObject({ is: 2, resultadoSensible: false });
  });

  it("does not block without citations: r 0 gives IL 1 and IS 2 with the no-evidence warning", () => {
    expect(avisosEstimacion(0, 3, CORTES)).toEqual({
      r: 0,
      il: 1,
      is: 2,
      resultadoSensible: false,
      sinEvidencia: true,
    });
  });

  it("rejects invalid input", () => {
    expect(() => avisosEstimacion(-1, 3, CORTES)).toThrow(RangeError);
    expect(() => avisosEstimacion(3, 0, CORTES)).toThrow(RangeError);
  });
});
