import { matchPath } from 'react-router'
import type { Rol } from './session'

/** Screens of the coordinator: projects, consolidation, comparison, analysis and audit. */
const COORDINADOR = [
  '/inicio',
  '/evaluaciones',
  '/evaluaciones/calificar',
  '/evaluaciones/consolidacion',
  '/evaluaciones/comparacion',
  '/evaluaciones/analisis',
  '/evaluaciones/auditoria',
  '/proyectos/nuevo',
  '/proyectos/:id/importancia',
  '/proyectos/:id/subfactores',
  '/proyectos/:id/resultado',
  '/proyectos/:id/consolidacion',
  '/proyectos/:id/comparacion',
  '/proyectos/:id/analisis',
  '/proyectos/:id/auditoria',
  '/historial',
  '/jurados',
]

/**
 * Route patterns each global role may open ("Permisos por pantalla", spec section 2).
 * The server enforces the same rules (RNF-08); this only shapes the interface.
 */
export const RUTAS_POR_ROL: Readonly<Record<Rol, readonly string[]>> = {
  invitado: ['/inicio'],
  coordinador: COORDINADOR,
  administrador: ['/inicio', '/admin/catalogo', '/admin/configuracion'],
}

/** Whether the role may open the given path of the authenticated area. */
export function puedeAcceder(rol: Rol, pathname: string): boolean {
  return (RUTAS_POR_ROL[rol] ?? []).some((pattern) => matchPath(pattern, pathname) !== null)
}
