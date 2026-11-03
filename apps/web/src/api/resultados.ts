import { leerToken } from '../auth/session'
import type { Alcance } from './consolidacion'
import { apiFetch } from './client'
import type { EstadoJurado } from './proyectos'

export type Foda = 'fortaleza' | 'oportunidad' | 'debilidad' | 'amenaza'
export type Nivel = 'A' | 'B' | 'C'
export type TipoBandera =
  | 'desacuerdo'
  | 'empate_tecnico'
  | 'metrica_contra_nivel'
  | 'metrica_alta_nivel_bajo'
  | 'factor_discutido'
  | 'datos_inciertos'

export interface FactorResultado {
  idProyectoFactor: number
  nombre: string
  ir: number
  alcance: Alcance
  pmPorJurado: { idUsuario: number; pm: number | null }[]
  pmConsolidada: number | null
  foda: Foda | null
}

export interface SoftwareResultado {
  id: number
  nombre: string
  ranking: number
  nivel: Nivel
  metrica: { final: number; minimo: number; maximo: number; desviacion: number }
  scoresJurado: { idUsuario: number; nombre: string; score: number | null }[]
  factores: FactorResultado[]
}

/** Results of a project (A6); `generadoEn` is null for a preview. */
export interface ResultadoProyecto {
  generadoEn: string | null
  softwares: SoftwareResultado[]
  banderas: {
    tipo: TipoBandera
    mensaje: string
    idSoftware?: number
    idProyectoFactor?: number
    idUsuario?: number
  }[]
}

/** Response of GET /api/proyectos/:id/resultados/mio (A6). */
export interface ResultadoMio {
  softwares: {
    id: number
    nombre: string
    score: number | null
    factores: { idProyectoFactor: number; nombre: string; pm: number | null; foda: Foda | null }[]
  }[]
}

/** Response of GET /api/proyectos/:id/auditoria (A6). */
export interface Auditoria {
  jurados: {
    idUsuario: number
    nombre: string
    estado: EstadoJurado
    importancias: { idProyectoFactor: number; factor: string; impDecisor: number | null }[]
    calificaciones: { total: number; desconozco: number; porcentajeDesconozco: number }
    scores: { idSoftware: number; score: number | null }[]
  }[]
}

// Results, comparison and audit endpoints of docs/api-contract.md (A6).

export function obtenerVistaPrevia(id: number): Promise<ResultadoProyecto> {
  return apiFetch<ResultadoProyecto>(`/proyectos/${id}/resultados/vista-previa`, { token: leerToken() })
}

export function generarResultados(id: number): Promise<ResultadoProyecto> {
  return apiFetch<ResultadoProyecto>(`/proyectos/${id}/resultados`, { method: 'POST', token: leerToken() })
}

export function obtenerResultados(id: number): Promise<ResultadoProyecto> {
  return apiFetch<ResultadoProyecto>(`/proyectos/${id}/resultados`, { token: leerToken() })
}

export function obtenerMiResultado(id: number): Promise<ResultadoMio> {
  return apiFetch<ResultadoMio>(`/proyectos/${id}/resultados/mio`, { token: leerToken() })
}

export function obtenerAuditoria(id: number): Promise<Auditoria> {
  return apiFetch<Auditoria>(`/proyectos/${id}/auditoria`, { token: leerToken() })
}
