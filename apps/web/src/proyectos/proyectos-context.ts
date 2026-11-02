import { createContext, use } from 'react'
import type { ProyectoResumen } from '../api/proyectos'

export interface ProyectosState {
  /** Projects visible to the user (GET /api/proyectos); null while loading or after an error. */
  proyectos: ProyectoResumen[] | null
  /** Projects where the user is an invited judge (GET /api/solicitudes). */
  solicitudes: ProyectoResumen[] | null
  error: string | null
  errorSolicitudes: string | null
  cargando: boolean
  /** Stores a project returned by a write, replacing the one with the same id. */
  registrar: (proyecto: ProyectoResumen) => void
  /** Forgets a project (a rejected request makes it invisible to the user). */
  quitar: (id: number) => void
}

export const ProyectosContext = createContext<ProyectosState | null>(null)

/** Projects and requests of the signed-in user; must be used under ProyectosProvider. */
export function useProyectos(): ProyectosState {
  const proyectos = use(ProyectosContext)
  if (!proyectos) throw new Error('useProyectos must be used within ProyectosProvider')
  return proyectos
}
