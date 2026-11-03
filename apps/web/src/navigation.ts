import {
  ClipboardCheck,
  History,
  House,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { puedeAcceder } from './auth/permissions'
import type { ProyectoResumen } from './api/proyectos'
import type { Rol } from './auth/session'

/** What the user must be in at least one project for an entry to show (miRol, miEstadoJurado). */
export type RequisitoProyecto = 'coordinador' | 'jurado'

export interface NavLinkItem {
  label: string
  to: string
  icon: LucideIcon
  requiere?: RequisitoProyecto
}

export interface NavGroupItem {
  label: string
  icon: LucideIcon
  /** Path prefixes that belong to the group; the group opens when one of them is active. */
  matches: string[]
  children: { label: string; to: string; requiere?: RequisitoProyecto }[]
}

export type NavItem = NavLinkItem | NavGroupItem

export function isNavGroup(item: NavItem): item is NavGroupItem {
  return 'children' in item
}

/** Sidebar entries, in the order of the prototypes. */
export const NAVIGATION: NavItem[] = [
  { label: 'Inicio', to: '/inicio', icon: House },
  {
    label: 'Evaluaciones',
    icon: ClipboardCheck,
    matches: ['/evaluaciones', '/proyectos'],
    children: [
      { label: 'Mis evaluaciones', to: '/evaluaciones' },
      { label: 'Nuevo proyecto', to: '/proyectos/nuevo' },
      { label: 'Calificar factores', to: '/evaluaciones/calificar', requiere: 'jurado' },
      { label: 'Consolidación y alcance', to: '/evaluaciones/consolidacion', requiere: 'coordinador' },
      { label: 'Comparación de softwares', to: '/evaluaciones/comparacion', requiere: 'coordinador' },
      { label: 'Análisis con IA', to: '/evaluaciones/analisis', requiere: 'coordinador' },
      { label: 'Auditoría de jurados', to: '/evaluaciones/auditoria', requiere: 'coordinador' },
    ],
  },
  { label: 'Historial', to: '/historial', icon: History },
  { label: 'Jurados', to: '/jurados', icon: Users, requiere: 'coordinador' },
  { label: 'Catálogo de factores', to: '/admin/catalogo', icon: ListChecks },
  { label: 'Configuración', to: '/admin/configuracion', icon: Settings },
]

/** Whether the projects satisfy the requirement; unknown projects (still loading) satisfy none. */
function cumple(requiere: RequisitoProyecto | undefined, proyectos: ProyectoResumen[] | null): boolean {
  if (!requiere) return true
  if (!proyectos) return false
  return requiere === 'coordinador'
    ? proyectos.some((proyecto) => proyecto.miRol === 'coordinador')
    : // An invited judge cannot answer yet (the API answers 403), so only active judges count.
      proyectos.some((proyecto) => proyecto.miEstadoJurado === 'activo')
}

/**
 * Sidebar entries for the user: the global role opens the screens, and the project role
 * (miRol and miEstadoJurado of GET /api/proyectos) decides the per-project ones.
 * A group without allowed children disappears.
 */
export function navigationFor(rol: Rol, proyectos: ProyectoResumen[] | null): NavItem[] {
  const permitido = (to: string, requiere?: RequisitoProyecto) =>
    puedeAcceder(rol, to) && cumple(requiere, proyectos)
  return NAVIGATION.flatMap((item): NavItem[] => {
    if (!isNavGroup(item)) return permitido(item.to, item.requiere) ? [item] : []
    const children = item.children.filter((child) => permitido(child.to, child.requiere))
    return children.length > 0 ? [{ ...item, children }] : []
  })
}
