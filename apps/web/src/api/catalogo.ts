import { leerToken } from '../auth/session'
import { apiFetch } from './client'
import type { Alcance } from './consolidacion'

export type OrigenFactor = 'tesis' | 'lit_2020_2025'

export interface FactorCatalogo {
  id: number
  nombre: string
  sugeridaDefault: number
  alcanceDefault: Alcance
  origen: OrigenFactor
  validadoExpertos: boolean
  subfactores: { id: number; texto: string }[]
}

/** Response of GET /api/catalogo/vigente (A2): active rows of the current version. */
export interface CatalogoVigente {
  version: { id: number; numero: number; fecha: string; motivo: string; rq1: number; rq2: number; rq3: number }
  dimensiones: { id: number; nombre: string; factores: FactorCatalogo[] }[]
}

export interface VersionCatalogo {
  id: number
  numero: number
  fecha: string
  motivo: string
}

// Catalog read endpoints of docs/api-contract.md (A2).

export function obtenerCatalogo(): Promise<CatalogoVigente> {
  return apiFetch<CatalogoVigente>('/catalogo/vigente', { token: leerToken() })
}

export function listarVersionesCatalogo(): Promise<VersionCatalogo[]> {
  return apiFetch<VersionCatalogo[]>('/catalogo/versiones', { token: leerToken() })
}

export type EstadoEstimacion = 'en_curso' | 'propuesta' | 'aprobada' | 'rechazada'

/** IS estimation of a new factor (A10); the IS is always computed by the server. */
export interface Estimacion {
  id: number
  estado: EstadoEstimacion
  modo: 'manual' | 'ia'
  factor: { id: number; nombre: string; idDimension: number; alcanceDefault: Alcance }
  subfactores: { id: number; texto: string; citas: number; dois: string[] }[]
  cortes: { rq1: number; rq2: number; rq3: number }
  tc: number | null
  ns: number
  r: number | null
  il: number | null
  isPropuesta: number | null
  isAprobada: number | null
  resultadoSensible: boolean
  sinEvidencia: boolean
  sinRespaldoVerificable: boolean
  progreso: { hechos: number; total: number } | null
  error: string | null
  justificacion: string | null
  creadoEn: string
}

/** Factor as administered (A10): active and inactive rows. */
export interface FactorAdmin {
  id: number
  nombre: string
  idDimension: number
  dimension: { id: number; nombre: string }
  sugeridaDefault: number
  alcanceDefault: Alcance
  origen: OrigenFactor
  isOrigen: string
  validadoExpertos: boolean
  activo: boolean
  subfactores: SubfactorAdmin[]
}

export interface SubfactorAdmin {
  id: number
  texto: string
  activo: boolean
}

export interface NuevoFactor {
  idDimension: number
  nombre: string
  alcanceDefault: Alcance
  subfactores: { texto: string; citas: number; dois?: string[] }[]
}

export interface Aprobacion {
  citas?: { idSubfactor: number; citas: number }[]
  isAprobada?: number
  justificacion?: string
}

// Catalog administration endpoints of docs/api-contract.md (A10, administrator only).

const token = () => ({ token: leerToken() })

export function crearFactor(body: NuevoFactor): Promise<Estimacion> {
  return apiFetch<Estimacion>('/catalogo/factores', { method: 'POST', body, ...token() })
}

export function estimarConIa(idFactor: number): Promise<Estimacion> {
  return apiFetch<Estimacion>(`/catalogo/factores/${idFactor}/estimaciones`, { method: 'POST', ...token() })
}

export function obtenerEstimacion(id: number): Promise<Estimacion> {
  return apiFetch<Estimacion>(`/catalogo/estimaciones/${id}`, token())
}

export function listarEstimaciones(estado?: EstadoEstimacion): Promise<Estimacion[]> {
  const filtro = estado ? `?estado=${estado}` : ''
  return apiFetch<Estimacion[]>(`/catalogo/estimaciones${filtro}`, token())
}

export function aprobarEstimacion(id: number, body: Aprobacion): Promise<Estimacion> {
  return apiFetch<Estimacion>(`/catalogo/estimaciones/${id}/aprobar`, { method: 'POST', body, ...token() })
}

export function rechazarEstimacion(id: number, justificacion: string): Promise<Estimacion> {
  return apiFetch<Estimacion>(`/catalogo/estimaciones/${id}/rechazar`, {
    method: 'POST',
    body: { justificacion },
    ...token(),
  })
}

export function listarFactoresAdmin(): Promise<FactorAdmin[]> {
  return apiFetch<FactorAdmin[]>('/catalogo/factores', token())
}

export function actualizarFactor(
  id: number,
  body: { nombre?: string; alcanceDefault?: Alcance; activo?: boolean },
): Promise<FactorAdmin> {
  return apiFetch<FactorAdmin>(`/catalogo/factores/${id}`, { method: 'PATCH', body, ...token() })
}

export function agregarSubfactor(idFactor: number, texto: string): Promise<SubfactorAdmin> {
  return apiFetch<SubfactorAdmin>(`/catalogo/factores/${idFactor}/subfactores`, {
    method: 'POST',
    body: { texto },
    ...token(),
  })
}

export function actualizarSubfactor(
  id: number,
  body: { texto?: string; activo?: boolean },
): Promise<SubfactorAdmin> {
  return apiFetch<SubfactorAdmin>(`/catalogo/subfactores/${id}`, { method: 'PATCH', body, ...token() })
}
