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
