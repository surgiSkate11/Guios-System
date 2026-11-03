import { matchPath } from 'react-router'
import type { Rol } from './session'

/**
 * Screens of any signed-in user that is not an administrator. Being a judge is a per-project
 * role, so the API decides what each project shows (miRol and miEstadoJurado).
 */
const NO_ADMINISTRADOR = [
  '/inicio',
  '/evaluaciones',
  '/evaluaciones/calificar',
  '/proyectos/:id',
  '/proyectos/:id/importancia',
  '/proyectos/:id/subfactores',
  '/proyectos/:id/resultado',
]

/** Screens only the coordinator opens: new project, consolidation, comparison, audit, judges. */
const SOLO_COORDINADOR = [
  '/evaluaciones/consolidacion',
  '/evaluaciones/comparacion',
  '/evaluaciones/analisis',
  '/evaluaciones/auditoria',
  '/proyectos/nuevo',
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
  invitado: NO_ADMINISTRADOR,
  coordinador: [...NO_ADMINISTRADOR, ...SOLO_COORDINADOR],
  administrador: [
    '/inicio',
    '/admin/catalogo',
    '/admin/catalogo/factores/nuevo',
    '/admin/catalogo/estimaciones/:id',
    '/admin/configuracion',
  ],
}

/** Whether the role may open the given path of the authenticated area. */
export function puedeAcceder(rol: Rol, pathname: string): boolean {
  return (RUTAS_POR_ROL[rol] ?? []).some((pattern) => {
    const match = matchPath(pattern, pathname)
    // A project id is numeric, so "/proyectos/nuevo" never reads as a project.
    return match !== null && (match.params.id === undefined || /^\d+$/.test(match.params.id))
  })
}
