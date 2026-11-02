import { leerToken } from '../auth/session'
import { apiFetch } from './client'
import type { Metodo } from './proyectos'

export type Alcance = 'interno' | 'externo'

export interface FactorConsolidado {
  idProyectoFactor: number
  factor: { id: number; nombre: string }
  dimension: { id: number; nombre: string }
  impSugerida: number
  importancias: { idUsuario: number; nombre: string; impDecisor: number | null }[]
  faltantes: number
  idConsolidada: number | null
  ir: number | null
  esRelevante: boolean | null
  alcanceDefault: Alcance
  alcanceEfectivo: Alcance
  justificacionAlcance: string | null
}

/** Response of GET /api/proyectos/:id/consolidacion (A5); a live preview until confirmed. */
export interface Consolidacion {
  confirmada: boolean
  metodo: Metodo
  factores: FactorConsolidado[]
}

// Consolidation and scope endpoints of docs/api-contract.md (A5).

export function obtenerConsolidacion(id: number): Promise<Consolidacion> {
  return apiFetch<Consolidacion>(`/proyectos/${id}/consolidacion`, { token: leerToken() })
}

export function confirmarConsolidacion(id: number): Promise<Consolidacion> {
  return apiFetch<Consolidacion>(`/proyectos/${id}/consolidacion/confirmar`, {
    method: 'POST',
    token: leerToken(),
  })
}

export function guardarAlcance(
  id: number,
  idProyectoFactor: number,
  body: { alcance: Alcance; justificacion?: string },
): Promise<FactorConsolidado> {
  return apiFetch<FactorConsolidado>(`/proyectos/${id}/factores/${idProyectoFactor}/alcance`, {
    method: 'PATCH',
    body,
    token: leerToken(),
  })
}
