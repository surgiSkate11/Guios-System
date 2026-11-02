import { describe, expect, it } from 'vitest'
import type { Rol } from './auth/session'
import { isNavGroup, navigationFor } from './navigation'
import { proyecto, proyectoComoJurado } from './test/proyectos-api'

/** Labels of the top-level links followed by the children of the Evaluaciones group. */
function etiquetas(rol: Rol, proyectos: Parameters<typeof navigationFor>[1]) {
  const items = navigationFor(rol, proyectos)
  return {
    top: items.filter((item) => !isNavGroup(item)).map((item) => item.label),
    hijos: items.filter(isNavGroup).flatMap((item) => item.children.map((child) => child.label)),
  }
}

describe('navigationFor (global role first, then miRol per project)', () => {
  it('gives the coordinator the basic entries while the projects are unknown or empty', () => {
    for (const proyectos of [null, []]) {
      expect(etiquetas('coordinador', proyectos)).toEqual({
        top: ['Inicio', 'Historial'],
        hijos: ['Mis evaluaciones', 'Nuevo proyecto'],
      })
    }
  })

  it('adds the coordinator screens once the user coordinates a project', () => {
    expect(etiquetas('coordinador', [proyecto()])).toEqual({
      top: ['Inicio', 'Historial', 'Jurados'],
      hijos: [
        'Mis evaluaciones',
        'Nuevo proyecto',
        'Consolidación y alcance',
        'Comparación de softwares',
        'Análisis con IA',
        'Auditoría de jurados',
      ],
    })
  })

  it('shows the judge screens only for an active judge of some project', () => {
    expect(etiquetas('invitado', [proyectoComoJurado('activo')])).toEqual({
      top: ['Inicio'],
      hijos: ['Mis evaluaciones', 'Calificar factores'],
    })
    for (const estado of ['invitado', 'finalizado'] as const) {
      expect(etiquetas('invitado', [proyectoComoJurado(estado)]).hijos).toEqual(['Mis evaluaciones'])
    }
  })

  it('combines both when the coordinator also judges their own project', () => {
    const propio = proyecto({ miEstadoJurado: 'activo' })
    expect(etiquetas('coordinador', [propio]).hijos).toContain('Calificar factores')
    expect(etiquetas('coordinador', [propio]).hijos).toContain('Consolidación y alcance')
  })

  it('never shows the project screens to the administrator', () => {
    expect(etiquetas('administrador', [proyecto()])).toEqual({
      top: ['Inicio', 'Catálogo de factores', 'Configuración'],
      hijos: [],
    })
  })
})
