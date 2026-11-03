import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ADMINISTRADOR, COORDINADOR } from '../../test/fake-api'
import { catalogoApi, estimacionDe } from '../../test/catalogo-api'
import { renderRoute } from '../../test/render-route'

type Usuario = ReturnType<typeof userEvent.setup>

const SENSIBLE = 'Resultado sensible: a una cita de cambiar de nivel'
const SIN_EVIDENCIA = 'Sin evidencia encontrada; no encontrar no significa que no exista'

function indicador(nombre: string) {
  return screen.getByRole('group', { name: nombre })
}

async function llenar(user: Usuario, citas: number[]) {
  await user.selectOptions(await screen.findByLabelText('Dimensión'), 'Organizacional')
  await user.type(screen.getByLabelText('Nombre del factor'), 'Integración con modelos de IA')
  await user.selectOptions(screen.getByLabelText('Alcance por defecto'), 'externo')
  for (let indice = 0; indice < citas.length; indice++) {
    if (indice > 0) await user.click(screen.getByRole('button', { name: 'Agregar subfactor' }))
    await user.type(screen.getByLabelText(`Subfactor ${indice + 1}`), `Subfactor ${indice + 1} de IA`)
    const campo = screen.getByLabelText(`Citas del subfactor ${indice + 1}`)
    await user.clear(campo)
    await user.type(campo, String(citas[indice]))
  }
}

// These tests type many fields; the default 5 s timeout is too short when the suite runs in parallel.
describe('Nuevo factor con IS en tiempo real (RF-22, HU-22, HU-23)', { timeout: 15_000 }, () => {
  it('computes TC, NS, r, IL and IS while typing (HU-22) and updates them at once (HU-23)', async () => {
    const user = userEvent.setup()
    const { requests } = renderRoute('/admin/catalogo/factores/nuevo', { usuario: ADMINISTRADOR, api: catalogoApi().handler })
    await llenar(user, [3, 2, 2])

    expect(indicador('TC')).toHaveTextContent('7')
    expect(indicador('NS')).toHaveTextContent('3')
    expect(indicador('r')).toHaveTextContent('2.33')
    expect(indicador('IL')).toHaveTextContent('4')
    expect(indicador('IS')).toHaveTextContent('3 · Importante')
    expect(screen.getByText(SENSIBLE)).toBeInTheDocument()
    expect(screen.getByText('Cortes: rq1 1.56 · rq2 2.00 · rq3 2.10')).toBeInTheDocument()

    const tercero = screen.getByLabelText('Citas del subfactor 3')
    await user.clear(tercero)
    await user.type(tercero, '1')

    expect(indicador('TC')).toHaveTextContent('6')
    expect(indicador('r')).toHaveTextContent('2.00')
    expect(indicador('IL')).toHaveTextContent('2')
    expect(indicador('IS')).toHaveTextContent('2 · Opcional')
    expect(screen.getByText(SENSIBLE)).toBeInTheDocument()
    // Computed in the browser: typing never calls the server (HU-23).
    expect(requests.some((r) => r.method === 'POST')).toBe(false)
  })

  it('does not block without citations: IL 1, IS 2 and the no-evidence notice', async () => {
    const user = userEvent.setup()
    renderRoute('/admin/catalogo/factores/nuevo', { usuario: ADMINISTRADOR, api: catalogoApi().handler })
    await llenar(user, [0, 0])

    expect(indicador('r')).toHaveTextContent('0.00')
    expect(indicador('IL')).toHaveTextContent('1')
    expect(indicador('IS')).toHaveTextContent('2 · Opcional')
    expect(screen.getByText(SIN_EVIDENCIA)).toBeInTheDocument()
    expect(screen.queryByText(SENSIBLE)).not.toBeInTheDocument()
  })

  it('saves the factor with the contract body and opens its estimation', async () => {
    const user = userEvent.setup()
    const { requests, router } = renderRoute('/admin/catalogo/factores/nuevo', {
      usuario: ADMINISTRADOR,
      api: catalogoApi().handler,
    })
    await llenar(user, [3, 4])
    await user.type(screen.getByLabelText('DOI del subfactor 1'), '10.1000/a, 10.1000/b')
    await user.click(screen.getByRole('button', { name: 'Guardar factor' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/catalogo/estimaciones/900'))
    expect(requests.find((r) => r.method === 'POST')).toMatchObject({
      path: '/api/catalogo/factores',
      body: {
        idDimension: 2,
        nombre: 'Integración con modelos de IA',
        alcanceDefault: 'externo',
        subfactores: [
          { texto: 'Subfactor 1 de IA', citas: 3, dois: ['10.1000/a', '10.1000/b'] },
          { texto: 'Subfactor 2 de IA', citas: 4 },
        ],
      },
    })
  })

  it('validates the form before calling the server', async () => {
    const user = userEvent.setup()
    const { requests } = renderRoute('/admin/catalogo/factores/nuevo', { usuario: ADMINISTRADOR, api: catalogoApi().handler })
    await screen.findByLabelText('Dimensión')

    await user.click(screen.getByRole('button', { name: 'Guardar factor' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del factor')

    await user.type(screen.getByLabelText('Nombre del factor'), 'Factor')
    await user.click(screen.getByRole('button', { name: 'Guardar factor' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Cada subfactor necesita un texto')
    expect(requests.some((r) => r.method === 'POST')).toBe(false)
  })

  it('removes a subfactor row and recomputes NS', async () => {
    const user = userEvent.setup()
    renderRoute('/admin/catalogo/factores/nuevo', { usuario: ADMINISTRADOR, api: catalogoApi().handler })
    await llenar(user, [3, 2, 2])
    await user.click(screen.getByRole('button', { name: 'Quitar subfactor 2' }))
    expect(indicador('NS')).toHaveTextContent('2')
    expect(indicador('TC')).toHaveTextContent('5')
  })

  it('is only for the administrator', async () => {
    const { router } = renderRoute('/admin/catalogo/factores/nuevo', { usuario: COORDINADOR, api: catalogoApi().handler })
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
  })
})

describe('Estimaciones pendientes en el catálogo', () => {
  it('lists the pending estimations with a link and offers a new factor', async () => {
    const api = catalogoApi({
      estimaciones: [estimacionDe(31, 'Integración con modelos de IA', [{ texto: 'Usa LLM', citas: 2 }])],
    })
    renderRoute('/admin/catalogo', { usuario: ADMINISTRADOR, api: api.handler })

    const pendientes = await screen.findByRole('region', { name: 'Estimaciones pendientes' })
    expect(await within(pendientes).findByRole('link', { name: /Integración con modelos de IA/ })).toHaveAttribute(
      'href',
      '/admin/catalogo/estimaciones/31',
    )
    expect(screen.getByRole('link', { name: 'Nuevo factor' })).toHaveAttribute('href', '/admin/catalogo/factores/nuevo')
  })
})
