import { AVISO_RESULTADO_SENSIBLE, AVISO_SIN_EVIDENCIA, avisosEstimacion } from '@guios/calculo'
import type { Importancia } from '@guios/calculo'

export const AVISO_SIN_RESPALDO = 'Sin respaldo verificable: hay subfactores con citas y sin DOI'

/** A subfactor as typed in the form: citations as entered, plus its DOIs. */
export interface CitaEnForm {
  citas: string
  dois: string[]
}

export interface IsEnVivo {
  tc: number
  ns: number
  /** Null while some citation count is not a non-negative integer. */
  calculo: { r: number; il: Importancia; is: Importancia } | null
  avisos: string[]
}

/** Parses a citation count; null unless it is a non-negative integer. */
export function leerCitas(valor: string): number | null {
  if (!/^\d+$/.test(valor.trim())) return null
  return Number(valor)
}

/** Splits the DOIs typed in one field, separated by commas, spaces or new lines. */
export function leerDois(valor: string): string[] {
  return valor
    .split(/[\s,;]+/)
    .map((doi) => doi.trim())
    .filter((doi) => doi !== '')
}

/**
 * TC, NS, r, IL and IS of a factor computed in the browser with the same rules as the server
 * (RN-01, RN-02, RN-04 via @guios/calculo, RNF-03), plus the section 6 warnings.
 */
export function calcularIsEnVivo(
  subfactores: CitaEnForm[],
  cortes: { rq1: number; rq2: number; rq3: number },
): IsEnVivo {
  const citas = subfactores.map((sub) => leerCitas(sub.citas))
  const ns = subfactores.length
  const validas = citas.every((valor) => valor !== null) && ns > 0
  const tc = citas.reduce<number>((suma, valor) => suma + (valor ?? 0), 0)
  const avisos: string[] = []
  if (!validas) return { tc, ns, calculo: null, avisos }

  const estimacion = avisosEstimacion(tc, ns, cortes)
  if (estimacion.resultadoSensible) avisos.push(AVISO_RESULTADO_SENSIBLE)
  if (estimacion.sinEvidencia) avisos.push(AVISO_SIN_EVIDENCIA)
  if (subfactores.some((sub, indice) => (citas[indice] ?? 0) > 0 && sub.dois.length === 0)) {
    avisos.push(AVISO_SIN_RESPALDO)
  }
  return { tc, ns, calculo: { r: estimacion.r, il: estimacion.il, is: estimacion.is }, avisos }
}
