import type { Alcance } from '../../api/consolidacion'
import type { Foda, Nivel, TipoBandera } from '../../api/resultados'

export const ETIQUETA_FODA: Record<Foda, string> = {
  fortaleza: 'Fortaleza',
  oportunidad: 'Oportunidad',
  debilidad: 'Debilidad',
  amenaza: 'Amenaza',
}

export const ESTILO_FODA: Record<Foda, string> = {
  fortaleza: 'bg-green-100 text-green-800',
  oportunidad: 'bg-blue-100 text-blue-800',
  debilidad: 'bg-orange-100 text-orange-800',
  amenaza: 'bg-red-100 text-red-700',
}

export const ETIQUETA_ALCANCE: Record<Alcance, string> = { interno: 'Interno', externo: 'Externo' }

export const ESTILO_NIVEL: Record<Nivel, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-amber-100 text-amber-800',
}

/** Flag types in the order of the prototype, with their label. */
export const BANDERAS: { tipo: TipoBandera; etiqueta: string }[] = [
  { tipo: 'empate_tecnico', etiqueta: 'Empate técnico' },
  { tipo: 'desacuerdo', etiqueta: 'Jurados en desacuerdo' },
  { tipo: 'metrica_contra_nivel', etiqueta: 'Métrica contra nivel' },
  { tipo: 'metrica_alta_nivel_bajo', etiqueta: 'Métrica alta con nivel bajo' },
  { tipo: 'factor_discutido', etiqueta: 'Factor discutido' },
  { tipo: 'datos_inciertos', etiqueta: 'Datos inciertos' },
]

/** Number with one decimal, or a dash when there is none. */
export function uno(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(1)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** ISO timestamp -> "09 oct 2026, 10:42" in local time. */
export function formatearMomento(iso: string): string {
  const fecha = new Date(iso)
  const dos = (valor: number) => String(valor).padStart(2, '0')
  return `${dos(fecha.getDate())} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}, ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
}
