import { leerToken } from '../auth/session'
import { apiFetch } from './client'

/** AI analysis of a project result (A9); `respaldo` means the fallback template was used. */
export interface Analisis {
  id: number
  texto: string
  modelo: string
  estado: 'completado' | 'fallido'
  respaldo: boolean
  creadoEn: string
}

export function obtenerAnalisis(id: number): Promise<Analisis> {
  return apiFetch<Analisis>(`/proyectos/${id}/analisis`, { token: leerToken() })
}

export function generarAnalisis(id: number): Promise<Analisis> {
  return apiFetch<Analisis>(`/proyectos/${id}/analisis`, { method: 'POST', token: leerToken() })
}
