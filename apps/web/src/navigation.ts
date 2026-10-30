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
import type { Rol } from './auth/session'

export interface NavLinkItem {
  label: string
  to: string
  icon: LucideIcon
}

export interface NavGroupItem {
  label: string
  icon: LucideIcon
  /** Path prefixes that belong to the group; the group opens when one of them is active. */
  matches: string[]
  children: { label: string; to: string }[]
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
      { label: 'Calificar factores', to: '/evaluaciones/calificar' },
      { label: 'Consolidación y alcance', to: '/evaluaciones/consolidacion' },
      { label: 'Comparación de softwares', to: '/evaluaciones/comparacion' },
      { label: 'Análisis con IA', to: '/evaluaciones/analisis' },
      { label: 'Auditoría de jurados', to: '/evaluaciones/auditoria' },
    ],
  },
  { label: 'Historial', to: '/historial', icon: History },
  { label: 'Jurados', to: '/jurados', icon: Users },
  { label: 'Catálogo de factores', to: '/admin/catalogo', icon: ListChecks },
  { label: 'Configuración', to: '/admin/configuracion', icon: Settings },
]

/** Sidebar entries the role may open; a group without allowed children disappears. */
export function navigationFor(rol: Rol): NavItem[] {
  return NAVIGATION.flatMap((item): NavItem[] => {
    if (!isNavGroup(item)) return puedeAcceder(rol, item.to) ? [item] : []
    const children = item.children.filter((child) => puedeAcceder(rol, child.to))
    return children.length > 0 ? [{ ...item, children }] : []
  })
}
