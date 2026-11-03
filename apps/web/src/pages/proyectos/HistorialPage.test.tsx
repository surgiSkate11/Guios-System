import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { COORDINADOR, TEST_TOKEN, type FakeHandler } from '../../test/fake-api'
import { proyecto, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

const CERRADOS = [
  proyecto({ id: 11, nombre: 'Portal de pagos', estado: 'cerrado', fechaInicio: '2026-09-14', fechaFin: '2026-10-06' }),
  proyecto({ id: 12, nombre: 'Portal académico', estado: 'cerrado', fechaInicio: '2026-08-01' }),
]

function api(cerrados: unknown, status = 200): FakeHandler {
  const base = proyectosApi([], COORDINADOR).handler
  return (request) =>
    request.method === 'GET' &&
    request.path === '/api/proyectos' &&
    request.search === '?estado=cerrado' &&
    request.headers.authorization === `Bearer ${TEST_TOKEN}`
      ? { status, body: cerrados }
      : base(request)
}

describe('Historial', () => {
  it('lists the closed projects with a link to their result', async () => {
    const { requests } = renderRoute('/historial', { usuario: COORDINADOR, api: api(CERRADOS) })

    const tabla = await screen.findByRole('table', { name: 'Proyectos cerrados' })
    const fila = within(tabla).getByRole('row', { name: /Portal de pagos/ })
    expect(fila).toHaveTextContent('Alcaldía Norte')
    expect(fila).toHaveTextContent('14 sep 2026')
    expect(fila).toHaveTextContent('06 oct 2026')
    expect(fila).toHaveTextContent('Versión 1')
    expect(within(fila).getByRole('link', { name: 'Ver resultado de Portal de pagos' })).toHaveAttribute(
      'href',
      '/proyectos/11/resultado',
    )
    expect(requests.some((r) => r.path === '/api/proyectos' && r.search === '?estado=cerrado')).toBe(true)
  })

  it('explains when there are no closed projects', async () => {
    renderRoute('/historial', { usuario: COORDINADOR, api: api([]) })
    expect(await screen.findByText('Todavía no hay proyectos cerrados.')).toBeInTheDocument()
  })

  it('shows the server message when the list cannot be loaded', async () => {
    renderRoute('/historial', {
      usuario: COORDINADOR,
      api: api({ statusCode: 500, message: 'Error interno' }, 500),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno')
  })
})
