import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ADMINISTRADOR } from '../../test/fake-api'
import { catalogoApi, estimacionDe } from '../../test/catalogo-api'
import { renderRoute } from '../../test/render-route'

const PROPUESTA = estimacionDe(31, 'Integración con modelos de IA', [
  { texto: 'Usa modelos de lenguaje', citas: 3, dois: ['10.1000/a'] },
  { texto: 'Expone una API de IA', citas: 2, dois: ['10.1000/b'] },
  { texto: 'Explica sus respuestas', citas: 2, dois: ['10.1000/c'] },
])

function abrir(opciones: Parameters<typeof catalogoApi>[0] = {}) {
  const api = catalogoApi({ estimaciones: [PROPUESTA], ...opciones })
  return { api, ...renderRoute('/admin/catalogo/estimaciones/31', { usuario: ADMINISTRADOR, api: api.handler }) }
}

describe('Estimación de la IS (RF-24, HU-22 a HU-24)', () => {
  it('shows the proposal with its subfactors and the IS computed by the server', async () => {
    abrir()
    expect(await screen.findByRole('heading', { level: 1, name: 'Integración con modelos de IA' })).toBeInTheDocument()
    expect(screen.getByText('Propuesta · manual')).toBeInTheDocument()
    expect(screen.getByLabelText('Citas de Usa modelos de lenguaje')).toHaveValue(3)
    expect(screen.getByRole('group', { name: 'IS' })).toHaveTextContent('3 · Importante')
    expect(screen.getByText('Resultado sensible: a una cita de cambiar de nivel')).toBeInTheDocument()
  })

  it('recomputes at once when the administrator corrects the citations and approves them', async () => {
    const user = userEvent.setup()
    const { requests, api } = abrir()
    const campo = await screen.findByLabelText('Citas de Explica sus respuestas')
    await user.clear(campo)
    await user.type(campo, '1')

    expect(screen.getByRole('group', { name: 'r' })).toHaveTextContent('2.00')
    expect(screen.getByRole('group', { name: 'IS' })).toHaveTextContent('2 · Opcional')
    expect(requests.some((r) => r.method === 'POST')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Aprobar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Factor aprobado con IS 2')
    expect(requests.find((r) => r.method === 'POST')).toMatchObject({
      path: '/api/catalogo/estimaciones/31/aprobar',
      body: { citas: [{ idSubfactor: 702, citas: 1 }] },
    })
    expect(api.estimaciones[0]!.estado).toBe('aprobada')
    expect(screen.getByText('Aprobada · manual')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
  })

  it('requires a justification to approve an IS different from the computed one', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    await user.selectOptions(await screen.findByLabelText('IS aprobada'), '4')
    await user.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Justificá la IS distinta de la calculada')
    expect(requests.some((r) => r.method === 'POST')).toBe(false)

    await user.type(screen.getByLabelText('Justificación'), 'Validado por expertos')
    await user.click(screen.getByRole('button', { name: 'Aprobar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Factor aprobado con IS 4')
    expect(requests.find((r) => r.method === 'POST')).toMatchObject({
      body: { isAprobada: 4, justificacion: 'Validado por expertos' },
    })
  })

  it('rejects with a justification', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    await user.click(await screen.findByRole('button', { name: 'Rechazar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribí la justificación del rechazo')

    await user.type(screen.getByLabelText('Justificación'), 'Evidencia insuficiente')
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Estimación rechazada')
    expect(requests.find((r) => r.method === 'POST')).toMatchObject({
      path: '/api/catalogo/estimaciones/31/rechazar',
      body: { justificacion: 'Evidencia insuficiente' },
    })
  })

  it('shows the server message when AI estimation is not configured', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Estimar con IA' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La estimación con IA no está configurada')
  })

  it('estimates with AI and polls the progress until the proposal is ready', async () => {
    const user = userEvent.setup()
    const { router, requests } = abrir({ iaConfigurada: true, pasosIa: 2 })
    await user.click(await screen.findByRole('button', { name: 'Estimar con IA' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/catalogo/estimaciones/900'))
    expect(await screen.findByText('Buscando evidencia: 1 de 3 subfactores')).toBeInTheDocument()
    expect(await screen.findByText('Propuesta · ia', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(requests.filter((r) => r.path === '/api/catalogo/estimaciones/900').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByLabelText('Citas de Usa modelos de lenguaje')).toHaveValue(4)
  }, 15_000)

  it('keeps polling after a transient error until the proposal is ready', async () => {
    const user = userEvent.setup()
    const api = catalogoApi({ estimaciones: [PROPUESTA], iaConfigurada: true, pasosIa: 2 })
    let lecturas = 0
    const conFallo: typeof api.handler = (request) => {
      if (request.method === 'GET' && request.path === '/api/catalogo/estimaciones/900') {
        lecturas += 1
        // The first poll after the initial load fails once.
        if (lecturas === 2) return { status: 503, body: { message: 'Servicio no disponible' } }
      }
      return api.handler(request)
    }
    renderRoute('/admin/catalogo/estimaciones/31', { usuario: ADMINISTRADOR, api: conFallo })
    await user.click(await screen.findByRole('button', { name: 'Estimar con IA' }))
    expect(await screen.findByText('Propuesta · ia', {}, { timeout: 8000 })).toBeInTheDocument()
  }, 15_000)

  it('warns when a cited subfactor has no DOI', async () => {
    const api = catalogoApi({
      estimaciones: [estimacionDe(32, 'Factor sin DOI', [{ texto: 'Sin referencias', citas: 2 }])],
    })
    renderRoute('/admin/catalogo/estimaciones/32', { usuario: ADMINISTRADOR, api: api.handler })
    const avisos = await screen.findByRole('list', { name: 'Avisos' })
    expect(within(avisos).getByText('Sin respaldo verificable: hay subfactores con citas y sin DOI')).toBeInTheDocument()
  })
})
