import type { Valor } from '../../api/evaluacion'

export const VALORES: Valor[] = [1, 2, 3, 4]

/** Importance scale: 1 Irrelevant, 2 Optional, 3 Important, 4 Fundamental. */
export const ETIQUETA_IMPORTANCIA: Record<number, string> = {
  1: 'Irrelevante',
  2: 'Opcional',
  3: 'Importante',
  4: 'Fundamental',
}

export const ESTILO_IMPORTANCIA: Record<number, string> = {
  1: 'bg-slate-100 text-slate-600',
  2: 'bg-amber-100 text-amber-800',
  3: 'bg-green-100 text-green-800',
  4: 'bg-blue-100 text-blue-800',
}

/** PM with one decimal over 4, or a dash when there is none. */
export function formatearPm(pm: number | null): string {
  return pm === null ? '—' : `${pm.toFixed(1)} / 4`
}
