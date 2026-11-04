import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COORDINADOR, INVITADO, TEST_TOKEN, type FakeHandler } from '../../test/fake-api'
import { combinar } from '../../test/evaluacion-api'
import { proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'
import { resultadoBase, resultadosApi } from '../../test/resultados-api'

const SOFTWARES = [{ id: 100, nombre: 'Software A', version: null, licencia: null }]

const pdfApi: FakeHandler = ({ method, path }) =>
  method === 'GET' && path === '/api/proyectos/10/resultados/pdf' ? { status: 200, body: '%PDF-1.7' } : undefined

function montar(path: string, persistido: ReturnType<typeof resultadoBase> | null, extra: FakeHandler = pdfApi) {
  const resultados = resultadosApi(10, { persistido })
  const proyectos = proyectosApi([proyecto({ id: 10, estado: 'en_curso', softwares: SOFTWARES })], COORDINADOR)
  return renderRoute(path, { usuario: COORDINADOR, api: combinar(extra, resultados.handler, proyectos.handler) })
}

describe('Exportar PDF (RF-19, HU-10)', () => {
  const crearUrl = vi.fn(() => 'blob:resultado')
  const revocarUrl = vi.fn()
  let descargado: string | null = null

  beforeEach(() => {
    descargado = null
    URL.createObjectURL = crearUrl
    URL.revokeObjectURL = revocarUrl
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargado = this.download
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    crearUrl.mockClear()
  })

  it('downloads the PDF of the result with the session token from Comparación', async () => {
    const user = userEvent.setup()
    const { requests } = montar('/proyectos/10/comparacion', resultadoBase())

    await user.click(await screen.findByRole('button', { name: 'Exportar PDF' }))

    await waitFor(() => expect(descargado).toBe('resultado-proyecto-10.pdf'))
    expect(requests.find((r) => r.path === '/api/proyectos/10/resultados/pdf')).toMatchObject({
      method: 'GET',
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    // The fetch Blob comes from Node, not from jsdom, so check its shape instead of its class.
    const blob = (crearUrl.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.size).toBeGreaterThan(0)
    // The object URL is released shortly after the click, not immediately.
    expect(revocarUrl).not.toHaveBeenCalled()
    await waitFor(() => expect(revocarUrl).toHaveBeenCalledWith('blob:resultado'), { timeout: 3000 })
  })

  it('offers the PDF from the consolidated result too', async () => {
    montar('/proyectos/10/resultado', resultadoBase())
    expect(await screen.findByRole('button', { name: 'Exportar PDF' })).toBeInTheDocument()
  })

  it('hides the button while no result was generated', async () => {
    montar('/proyectos/10/comparacion', null)
    await screen.findByRole('table', { name: 'Ranking de softwares' })
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).not.toBeInTheDocument()
  })

  it('offers the PDF right after generating the results', async () => {
    const user = userEvent.setup()
    montar('/proyectos/10/comparacion', null)
    await user.click(await screen.findByRole('button', { name: 'Generar resultados' }))
    expect(await screen.findByRole('button', { name: 'Exportar PDF' })).toBeInTheDocument()
  })

  it('keeps the button when loading the stored result fails for a reason other than 404', async () => {
    const caido: FakeHandler = (request) =>
      request.method === 'GET' && request.path === '/api/proyectos/10/resultados'
        ? { status: 500, body: { message: 'Error interno' } }
        : pdfApi(request)
    montar('/proyectos/10/comparacion', null, caido)
    expect(await screen.findByRole('button', { name: 'Exportar PDF' })).toBeInTheDocument()
  })

  it('shows the server message when the PDF cannot be built', async () => {
    const user = userEvent.setup()
    montar('/proyectos/10/comparacion', resultadoBase(), ({ path }) =>
      path === '/api/proyectos/10/resultados/pdf'
        ? { status: 404, body: { statusCode: 404, message: 'Aún no hay resultados' } }
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Exportar PDF' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Aún no hay resultados')
    expect(descargado).toBeNull()
  })

  it('is not offered to a judge', async () => {
    const resultados = resultadosApi(20)
    const proyectos = proyectosApi([proyectoComoJurado('activo', { softwares: SOFTWARES })], INVITADO)
    renderRoute('/proyectos/20/resultado', { usuario: INVITADO, api: combinar(resultados.handler, proyectos.handler) })
    await screen.findByRole('heading', { name: 'Tu métrica' })
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).not.toBeInTheDocument()
  })
})
