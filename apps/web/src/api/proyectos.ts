import { leerToken } from '../auth/session'
import { apiFetch } from './client'
import type { Metodo } from './admin'

export type { Metodo }
export type EstadoProyecto = 'borrador' | 'en_curso' | 'cerrado'
export type EstadoJurado = 'invitado' | 'activo' | 'finalizado'

export interface UsuarioResumen {
  id: number
  nombre: string
  email: string
}

export interface SoftwareResumen {
  id: number
  nombre: string
  version: string | null
  licencia: string | null
}

export interface JuradoResumen {
  idUsuario: number
  nombre: string
  email: string
  estado: EstadoJurado
  idDimensiones: number[]
}

export interface ProyectoResumen {
  id: number
  nombre: string
  estado: EstadoProyecto
  metodoConsolidacion: Metodo
  fechaInicio: string
  fechaFin: string | null
  versionCatalogo: number
  organizacion: { id: number; nombre: string }
  coordinador: UsuarioResumen
  softwares: SoftwareResumen[]
  jurados: JuradoResumen[]
  dimensiones: { id: number; nombre: string }[]
  /** Coordinator wins when the user is both. */
  miRol: 'coordinador' | 'jurado'
  miEstadoJurado: EstadoJurado | null
}

export interface NuevoSoftware {
  nombre: string
  version?: string
  licencia?: string
}

export interface NuevoProyecto {
  nombre: string
  fechaInicio: string
  fechaFin?: string
  metodoConsolidacion: Metodo
  idDimensiones: number[]
  softwares: NuevoSoftware[]
}

/** Part of GET /api/catalogo/vigente (A2) the project form needs. */
export interface CatalogoDimensiones {
  version: { id: number; numero: number }
  dimensiones: { id: number; nombre: string }[]
}

// Project endpoints of docs/api-contract.md (A3); all use the stored session token.

export function obtenerCatalogoVigente(): Promise<CatalogoDimensiones> {
  return apiFetch<CatalogoDimensiones>('/catalogo/vigente', { token: leerToken() })
}

export function listarProyectos(): Promise<ProyectoResumen[]> {
  return apiFetch<ProyectoResumen[]>('/proyectos', { token: leerToken() })
}

export function obtenerProyecto(id: number): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}`, { token: leerToken() })
}

export function crearProyecto(body: NuevoProyecto): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>('/proyectos', { method: 'POST', body, token: leerToken() })
}

export function agregarSoftware(id: number, body: NuevoSoftware): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}/softwares`, {
    method: 'POST',
    body,
    token: leerToken(),
  })
}

export function quitarSoftware(id: number, idSoftware: number): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}/softwares/${idSoftware}`, {
    method: 'DELETE',
    token: leerToken(),
  })
}

export function cambiarEstadoProyecto(
  id: number,
  estado: 'en_curso' | 'cerrado',
): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}/estado`, {
    method: 'POST',
    body: { estado },
    token: leerToken(),
  })
}

export function buscarUsuarioPorEmail(email: string): Promise<UsuarioResumen> {
  return apiFetch<UsuarioResumen>(`/usuarios/buscar?email=${encodeURIComponent(email)}`, {
    token: leerToken(),
  })
}

export function agregarJurado(id: number, idUsuario: number): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}/jurados`, {
    method: 'POST',
    body: { idUsuario },
    token: leerToken(),
  })
}

export function finalizarJurado(id: number, idUsuario: number): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}/jurados/${idUsuario}`, {
    method: 'PATCH',
    body: { estado: 'finalizado' },
    token: leerToken(),
  })
}

export function quitarJurado(id: number, idUsuario: number): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}/jurados/${idUsuario}`, {
    method: 'DELETE',
    token: leerToken(),
  })
}

export function listarSolicitudes(): Promise<ProyectoResumen[]> {
  return apiFetch<ProyectoResumen[]>('/solicitudes', { token: leerToken() })
}

export function aceptarSolicitud(id: number): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}/solicitud/aceptar`, {
    method: 'POST',
    token: leerToken(),
  })
}

/** Answers 204: the judge row is removed. */
export function rechazarSolicitud(id: number): Promise<void> {
  return apiFetch<void>(`/proyectos/${id}/solicitud/rechazar`, {
    method: 'POST',
    token: leerToken(),
  })
}

export function actualizarProyecto(
  id: number,
  body: { nombre?: string; fechaFin?: string; metodoConsolidacion?: Metodo },
): Promise<ProyectoResumen> {
  return apiFetch<ProyectoResumen>(`/proyectos/${id}`, { method: 'PATCH', body, token: leerToken() })
}

export function listarProyectosCerrados(): Promise<ProyectoResumen[]> {
  return apiFetch<ProyectoResumen[]>('/proyectos?estado=cerrado', { token: leerToken() })
}
