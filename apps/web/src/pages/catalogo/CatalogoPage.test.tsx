import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CatalogoVigente } from '../../api/catalogo'
import { ADMINISTRADOR, type FakeHandler } from '../../test/fake-api'
import { renderRoute } from '../../test/render-route'

const CATALOGO: CatalogoVigente = {
  version: { id: 1, numero: 1, fecha: '2026-10-01', motivo: 'Carga inicial de la tesis', rq1: 1.86, rq2: 3.65, rq3: 4.78 },
  dimensiones: [
    {
      id: 1,
      nombre: 'Tecnológica',
      factores: [
        {
          id: 1,
          nombre: 'Compatibilidad',
          sugeridaDefault: 3,
          alcanceDefault: 'interno',
          origen: 'tesis',
          validadoExpertos: true,
          subfactores: [
            { id: 11, texto: 'El software usa formatos estándar' },
            { id: 12, texto: 'El software es compatible con varios sistemas operativos' },
          ],
        },
        {
          id: 2,
          nombre: 'Prueba',
          sugeridaDefault: 2,
          alcanceDefault: 'interno',
          origen: 'lit_2020_2025',
          validadoExpertos: false,
          subfactores: [{ id: 21, texto: 'Existe una versión de prueba' }],
        },
      ],
    },
    {
      id: 2,
      nombre: 'Económica',
      factores: [
        {
          id: 3,
          nombre: 'Coste total de propiedad',
          sugeridaDefault: 3,
          alcanceDefault: 'externo',
          origen: 'tesis',
          validadoExpertos: true,
          subfactores: [],
        },
      ],
    },
  ],
}

const VERSIONES = [
  { id: 1, numero: 1, fecha: '2026-10-01', motivo: 'Carga inicial de la tesis' },
]

const catalogoApi: FakeHandler = ({ method, path }) => {
  if (method === 'GET' && path === '/api/catalogo/vigente') return { status: 200, body: CATALOGO }
  if (method === 'GET' && path === '/api/catalogo/versiones') return { status: 200, body: VERSIONES }
  if (method === 'GET' && (path === '/api/catalogo/estimaciones' || path === '/api/catalogo/factores')) {
    return { status: 200, body: [] }
  }
  return undefined
}

describe('Catálogo de factores (lectura)', () => {
  it('shows the current version, its cut points and the dimensions with their factor count', async () => {
    renderRoute('/admin/catalogo', { usuario: ADMINISTRADOR, api: catalogoApi })

    expect(await screen.findByText('Versión de catálogo 1')).toBeInTheDocument()
    expect(screen.getByText('Cortes: rq1 1.86 · rq2 3.65 · rq3 4.78')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tecnológica.*2 factores/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Económica.*1 factor$/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('lists each factor with suggested importance, default scope, origin and validation', async () => {
    renderRoute('/admin/catalogo', { usuario: ADMINISTRADOR, api: catalogoApi })

    const tabla = await screen.findByRole('table', { name: 'Factores de Tecnológica' })
    const compatibilidad = within(tabla).getByRole('row', { name: /^Compatibilidad/ })
    expect(within(compatibilidad).getAllByRole('cell').map((celda) => celda.textContent)).toEqual([
      'Importante',
      'Interno',
      'tesis',
      'Sí',
      '2',
    ])
    const prueba = within(tabla).getByRole('row', { name: /^Prueba/ })
    expect(within(prueba).getAllByRole('cell').map((celda) => celda.textContent)).toEqual([
      'Opcional',
      'Interno',
      'lit 2020-2025',
      'No validado',
      '1',
    ])
  })

  it('expands a factor to show its subfactors and a dimension to show its factors', async () => {
    const user = userEvent.setup()
    renderRoute('/admin/catalogo', { usuario: ADMINISTRADOR, api: catalogoApi })
    await screen.findByRole('table', { name: 'Factores de Tecnológica' })
    expect(screen.queryByText('El software usa formatos estándar')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver subfactores de Compatibilidad' }))
    expect(screen.getByText('El software usa formatos estándar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Económica/ }))
    expect(screen.getByRole('table', { name: 'Factores de Económica' })).toBeInTheDocument()
  })

  it('lists the catalog versions', async () => {
    renderRoute('/admin/catalogo', { usuario: ADMINISTRADOR, api: catalogoApi })
    const versiones = await screen.findByRole('table', { name: 'Versiones del catálogo' })
    expect(within(versiones).getByRole('row', { name: /Versión 1/ })).toHaveTextContent(
      'Versión 101 oct 2026Carga inicial de la tesis',
    )
  })

  it('explains when no catalog is loaded', async () => {
    renderRoute('/admin/catalogo', {
      usuario: ADMINISTRADOR,
      api: ({ method, path }) =>
        method === 'GET' && path === '/api/catalogo/vigente'
          ? { status: 404, body: { statusCode: 404, message: 'No hay un catálogo cargado' } }
          : undefined,
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay un catálogo cargado')
  })
})
