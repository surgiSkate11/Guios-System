import { leerToken } from '../auth/session'
import { apiFetch } from './client'

type Ref = { id: number; nombre: string }
export type Valor = 1 | 2 | 3 | 4

/** Row of GET /api/proyectos/:id/importancias/mias (A4). */
export interface ImportanciaMia {
  idProyectoFactor: number
  factor: Ref
  dimension: Ref
  impSugerida: number
  impDecisor: number | null
}

export interface SubfactorCalificado {
  id: number
  texto: string
  valor: Valor | null
  desconozco: boolean
  respondido: boolean
}

export interface FactorCalificado {
  idProyectoFactor: number
  factor: Ref
  dimension: Ref
  ir: number
  pm: number | null
  subfactores: SubfactorCalificado[]
}

/** Response of GET /api/proyectos/:id/calificaciones/mias?software=:id (A4). */
export interface CalificacionesMias {
  software: Ref
  factores: FactorCalificado[]
}

/** Body of PUT /api/proyectos/:id/calificaciones: exactly one of `valor` or `desconozco`. */
export type NuevaCalificacion =
  | { idSoftware: number; idSubfactor: number; valor: Valor }
  | { idSoftware: number; idSubfactor: number; desconozco: true }

// Judge answer endpoints of docs/api-contract.md (A4).

export function listarMisImportancias(id: number): Promise<ImportanciaMia[]> {
  return apiFetch<ImportanciaMia[]>(`/proyectos/${id}/importancias/mias`, { token: leerToken() })
}

export function guardarImportancia(
  id: number,
  idProyectoFactor: number,
  impDecisor: Valor,
): Promise<{ idProyectoFactor: number; impDecisor: number }> {
  return apiFetch(`/proyectos/${id}/importancias/${idProyectoFactor}`, {
    method: 'PUT',
    body: { impDecisor },
    token: leerToken(),
  })
}

export function obtenerMisCalificaciones(id: number, idSoftware: number): Promise<CalificacionesMias> {
  return apiFetch<CalificacionesMias>(`/proyectos/${id}/calificaciones/mias?software=${idSoftware}`, {
    token: leerToken(),
  })
}

export function guardarCalificacion(
  id: number,
  body: NuevaCalificacion,
): Promise<{ idProyectoFactor: number; pm: number | null }> {
  return apiFetch(`/proyectos/${id}/calificaciones`, { method: 'PUT', body, token: leerToken() })
}
