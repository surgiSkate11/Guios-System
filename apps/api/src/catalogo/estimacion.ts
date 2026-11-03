import { avisosEstimacion, type Cortes } from '@guios/calculo';
import type { Alcance, EstimacionIs, Factor } from '../generated/prisma/client';

/** One subfactor with the citations that support it, stored in citas_por_subfactor_json. */
export interface CitasSubfactor {
  idSubfactor: number;
  texto: string;
  citas: number;
  dois: string[];
}

export interface Progreso {
  hechos: number;
  total: number;
}

export interface Estimacion {
  id: number;
  estado: 'en_curso' | 'propuesta' | 'aprobada' | 'rechazada';
  modo: 'manual' | 'ia';
  factor: {
    id: number;
    nombre: string;
    idDimension: number;
    alcanceDefault: Alcance;
  };
  subfactores: { id: number; texto: string; citas: number; dois: string[] }[];
  cortes: Cortes;
  tc: number | null;
  ns: number;
  r: number | null;
  il: number | null;
  isPropuesta: number | null;
  isAprobada: number | null;
  resultadoSensible: boolean;
  sinEvidencia: boolean;
  sinRespaldoVerificable: boolean;
  progreso: Progreso | null;
  error: string | null;
  justificacion: string | null;
  creadoEn: string;
}

const PREFIJO_DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:)/i;
export const DOI_VALIDO =
  /^(?:(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:))?10\.\d{4,9}\/\S+$/i;

export const normalizarDoi = (doi: string) =>
  doi.trim().replace(PREFIJO_DOI, '').toLowerCase();

/** RN-01, RN-02 and RN-04 computed by @guios/calculo; the AI never computes them. */
export function calcularIs(citas: CitasSubfactor[], cortes: Cortes) {
  const tc = citas.reduce((suma, s) => suma + s.citas, 0);
  return {
    tc,
    ns: citas.length,
    ...avisosEstimacion(tc, citas.length, cortes),
  };
}

export function toEstimacion(
  fila: EstimacionIs & { factor: Factor },
  cortes: Cortes,
  progreso: Progreso | null = null,
): Estimacion {
  const citas = (fila.citasPorSubfactorJson ??
    []) as unknown as CitasSubfactor[];
  const calculo =
    citas.length > 0 && fila.estado !== 'en_curso'
      ? calcularIs(citas, cortes)
      : null;
  const errorJson = fila.descartesJson as { error?: string } | null;
  return {
    id: fila.id,
    estado: fila.estado,
    modo: fila.modo,
    factor: {
      id: fila.factor.id,
      nombre: fila.factor.nombre,
      idDimension: fila.factor.idDimension,
      alcanceDefault: fila.factor.alcanceDefault,
    },
    subfactores: citas.map((s) => ({
      id: s.idSubfactor,
      texto: s.texto,
      citas: s.citas,
      dois: s.dois,
    })),
    cortes,
    tc: fila.tc,
    ns: fila.ns ?? citas.length,
    r: fila.r,
    il: fila.il,
    isPropuesta: fila.isPropuesta,
    isAprobada: fila.isAprobada,
    resultadoSensible: calculo?.resultadoSensible ?? false,
    sinEvidencia: calculo?.sinEvidencia ?? false,
    sinRespaldoVerificable: citas.some(
      (s) => s.citas > 0 && s.dois.length === 0,
    ),
    progreso,
    error: errorJson?.error ?? null,
    justificacion: fila.justificacion,
    creadoEn: fila.creadoEn.toISOString(),
  };
}
