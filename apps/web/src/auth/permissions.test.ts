import { describe, expect, it } from 'vitest'
import { puedeAcceder } from './permissions'

// Any signed-in user that is not an administrator: the API decides per project (miRol).
const NO_ADMIN_ROUTES = [
  '/inicio',
  '/evaluaciones',
  '/evaluaciones/calificar',
  '/proyectos/7',
  '/proyectos/7/importancia',
  '/proyectos/7/subfactores',
  '/proyectos/7/resultado',
]

const COORDINADOR_ONLY_ROUTES = [
  '/proyectos/nuevo',
  '/evaluaciones/consolidacion',
  '/evaluaciones/comparacion',
  '/evaluaciones/analisis',
  '/evaluaciones/auditoria',
  '/proyectos/7/consolidacion',
  '/proyectos/7/comparacion',
  '/proyectos/7/analisis',
  '/proyectos/7/auditoria',
  '/historial',
  '/jurados',
]

const ADMINISTRADOR_ROUTES = ['/inicio', '/admin/catalogo', '/admin/configuracion']

describe('puedeAcceder (permissions by screen, spec section 2)', () => {
  it('lets the guest open the screens shared by every non-admin user', () => {
    for (const path of NO_ADMIN_ROUTES) {
      expect(puedeAcceder('invitado', path), path).toBe(true)
    }
  })

  it('keeps the coordinator-only and admin screens closed for the guest', () => {
    for (const path of [...COORDINADOR_ONLY_ROUTES, '/admin/catalogo', '/admin/configuracion']) {
      expect(puedeAcceder('invitado', path), path).toBe(false)
    }
  })

  it('lets the coordinator open the shared and the coordinator-only screens but not the admin ones', () => {
    for (const path of [...NO_ADMIN_ROUTES, ...COORDINADOR_ONLY_ROUTES]) {
      expect(puedeAcceder('coordinador', path), path).toBe(true)
    }
    expect(puedeAcceder('coordinador', '/admin/catalogo')).toBe(false)
    expect(puedeAcceder('coordinador', '/admin/configuracion')).toBe(false)
  })

  it('lets the administrator open only the home panel, the catalog and the configuration', () => {
    for (const path of ADMINISTRADOR_ROUTES) {
      expect(puedeAcceder('administrador', path), path).toBe(true)
    }
    for (const path of [...NO_ADMIN_ROUTES, ...COORDINADOR_ONLY_ROUTES]) {
      if (path === '/inicio') continue
      expect(puedeAcceder('administrador', path), path).toBe(false)
    }
  })

  it('does not read "nuevo" as a project id', () => {
    expect(puedeAcceder('invitado', '/proyectos/nuevo')).toBe(false)
    expect(puedeAcceder('coordinador', '/proyectos/nuevo')).toBe(true)
    expect(puedeAcceder('coordinador', '/proyectos/abc')).toBe(false)
  })

  it('ignores a trailing slash and denies unknown paths', () => {
    expect(puedeAcceder('administrador', '/admin/catalogo/')).toBe(true)
    expect(puedeAcceder('coordinador', '/otra')).toBe(false)
    expect(puedeAcceder('coordinador', '/proyectos/7/otra')).toBe(false)
  })
})
