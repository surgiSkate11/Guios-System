import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { catalogoApi } from '../../test/catalogo-api'
import { ADMINISTRADOR } from '../../test/fake-api'
import { renderRoute } from '../../test/render-route'

/**
 * The anchor panel lives in the catalog screen, so the tests open `/admin/catalogo` against the
 * fake API and look for the anchors block.
 */
function abrir(opciones: Parameters<typeof catalogoApi>[0] = {}) {
  const api = catalogoApi(opciones)
  return { api, ...renderRoute('/admin/catalogo', { usuario: ADMINISTRADOR, api: api.handler }) }
}

function tablaAnclas() {
  return screen.findByRole('table', { name: 'Anclas de la versión vigente' })
}

describe('Medición de anclas (sección 6, RN-02, A11)', () => {
  it('lists the anchors of the current version with their TC, NS, r and the IL read with the published cuts', async () => {
    abrir()

    const tabla = await tablaAnclas()
    const compatibilidad = within(tabla).getByRole('row', { name: /^Compatibilidad/ })
    // 33 / 8 = 4.125, above rq3 2.10, so the IL of the anchor is 4 (Fundamental).
    expect(within(compatibilidad).getAllByRole('cell').map((celda) => celda.textContent)).toEqual([
      '33',
      '8',
      '4.13',
      '4 · Fundamental',
    ])
    expect(screen.getByLabelText('Dispersión de las anclas')).toHaveTextContent('4.13')
    expect(
      screen.getByText('Todos los factores activos tienen ancla en esta versión.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Medir anclas' })).toBeDisabled()
  })

  it('measures only the factors without an anchor and polls until the new version is published', async () => {
    const user = userEvent.setup()
    const { requests } = abrir({ anclas: [], iaConfigurada: true, pasosAnclas: 2 })
    expect(await screen.findByText('Todavía no hay anclas medidas en esta versión.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Medir anclas' }))
    const confirmacion = screen.getByRole('group', { name: 'Confirmar medición de anclas' })
    expect(confirmacion).toHaveTextContent('Se medirá 1 factor con la IA')
    await user.click(within(confirmacion).getByRole('button', { name: 'Sí, medir anclas' }))

    expect(await screen.findByText(/Midiendo 0 de 1 factores/)).toBeInTheDocument()
    expect(
      await screen.findByText(/Midiendo 1 de 1 factores · Compatibilidad/, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Anclas medidas: el catálogo publicó la versión 2',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
    expect(requests.find((request) => request.method === 'POST')).toMatchObject({
      path: '/api/catalogo/anclas/medir',
    })

    const tabla = await tablaAnclas()
    expect(within(tabla).getByRole('row', { name: /^Compatibilidad/ })).toHaveTextContent('4.00')
  }, 15_000)

  it('shows the server message when the AI is not configured (RNF-06)', async () => {
    const user = userEvent.setup()
    const { requests } = abrir({ anclas: [] })

    await user.click(await screen.findByRole('button', { name: 'Medir anclas' }))
    await user.click(screen.getByRole('button', { name: 'Sí, medir anclas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La medición de anclas requiere la IA configurada',
    )
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1)
  })

  it('shows the server message when a measurement is already running (RNF-12)', async () => {
    const user = userEvent.setup()
    abrir({ anclas: [], iaConfigurada: true, medicionEnCurso: true })

    await user.click(await screen.findByRole('button', { name: 'Medir anclas' }))
    await user.click(screen.getByRole('button', { name: 'Sí, medir anclas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya hay una medición de anclas en curso',
    )
  })
})
