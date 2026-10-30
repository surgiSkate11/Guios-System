import { describe, expect, it } from 'vitest'
import { puedeAcceder } from './permissions'

const COORDINADOR_ROUTES = [
  '/inicio',
  '/evaluaciones',
  '/proyectos/nuevo',
  '/evaluaciones/calificar',
  '/evaluaciones/consolidacion',
  '/evaluaciones/comparacion',
  '/evaluaciones/analisis',
  '/evaluaciones/auditoria',
  '/proyectos/7/importancia',
  '/proyectos/7/subfactores',
  '/proyectos/7/resultado',
  '/proyectos/7/consolidacion',
  '/proyectos/7/comparacion',
  '/proyectos/7/analisis',
  '/proyectos/7/auditoria',
  '/historial',
  '/jurados',
]

const ADMINISTRADOR_ROUTES = ['/inicio', '/admin/catalogo', '/admin/configuracion']

describe('puedeAcceder (permissions by screen, spec section 2)', () => {
  it('lets the guest open only the home panel (HU-18)', () => {
    expect(puedeAcceder('invitado', '/inicio')).toBe(true)
    for (const path of [...COORDINADOR_ROUTES, ...ADMINISTRADOR_ROUTES]) {
      if (path === '/inicio') continue
      expect(puedeAcceder('invitado', path), path).toBe(false)
    }
  })

  it('lets the coordinator open the project screens but not the admin ones', () => {
    for (const path of COORDINADOR_ROUTES) {
      expect(puedeAcceder('coordinador', path), path).toBe(true)
    }
    expect(puedeAcceder('coordinador', '/admin/catalogo')).toBe(false)
    expect(puedeAcceder('coordinador', '/admin/configuracion')).toBe(false)
  })

  it('lets the administrator open the catalog and configuration but not the project screens', () => {
    for (const path of ADMINISTRADOR_ROUTES) {
      expect(puedeAcceder('administrador', path), path).toBe(true)
    }
    for (const path of COORDINADOR_ROUTES) {
      if (path === '/inicio') continue
      expect(puedeAcceder('administrador', path), path).toBe(false)
    }
  })

  it('ignores a trailing slash and denies unknown paths', () => {
    expect(puedeAcceder('administrador', '/admin/catalogo/')).toBe(true)
    expect(puedeAcceder('coordinador', '/otra')).toBe(false)
    expect(puedeAcceder('coordinador', '/proyectos/7/otra')).toBe(false)
  })
})
