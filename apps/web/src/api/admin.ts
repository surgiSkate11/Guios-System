import { leerToken, type Rol } from '../auth/session'
import { apiFetch } from './client'

export type { Rol }
export type Sector = 'publico' | 'privado' | 'independiente'
export type Metodo = 'mediana' | 'promedio'

export interface Organizacion {
  id: number
  nombre: string
  sector: Sector
  activo: boolean
}

export interface UsuarioAdmin {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  idOrganizacion: number | null
  organizacion: { id: number; nombre: string } | null
}

export interface Parametros {
  umbralFoda: number
  umbralDesacuerdo: number
  umbralEmpateTecnico: number
  umbralMetricaAlta: number
  umbralFactorDiscutido: number
  umbralDatosInciertos: number
  metodoConsolidacion: Metodo
}

// Administration endpoints of docs/api-contract.md (A1); all use the stored session token.

export function listarOrganizaciones(): Promise<Organizacion[]> {
  return apiFetch<Organizacion[]>('/organizaciones', { token: leerToken() })
}

export function crearOrganizacion(body: { nombre: string; sector: Sector }): Promise<Organizacion> {
  return apiFetch<Organizacion>('/organizaciones', { method: 'POST', body, token: leerToken() })
}

export function actualizarOrganizacion(
  id: number,
  body: { nombre?: string; sector?: Sector; activo?: boolean },
): Promise<Organizacion> {
  return apiFetch<Organizacion>(`/organizaciones/${id}`, {
    method: 'PATCH',
    body,
    token: leerToken(),
  })
}

export function listarUsuarios(): Promise<UsuarioAdmin[]> {
  return apiFetch<UsuarioAdmin[]>('/usuarios', { token: leerToken() })
}

export function actualizarUsuario(
  id: number,
  body: { rol?: Rol; idOrganizacion?: number | null; activo?: boolean },
): Promise<UsuarioAdmin> {
  return apiFetch<UsuarioAdmin>(`/usuarios/${id}`, { method: 'PATCH', body, token: leerToken() })
}

export function obtenerParametros(): Promise<Parametros> {
  return apiFetch<Parametros>('/parametros', { token: leerToken() })
}

export function guardarParametros(body: Parametros): Promise<Parametros> {
  return apiFetch<Parametros>('/parametros', { method: 'PUT', body, token: leerToken() })
}
