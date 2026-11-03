import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Analisis } from '../../api/analisis'
import { COORDINADOR, type FakeHandler } from '../../test/fake-api'
import { combinar } from '../../test/evaluacion-api'
import { proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'
import { resultadoBase, resultadosApi } from '../../test/resultados-api'

const ANALISIS: Analisis = {
  id: 1,
  texto: 'Se recomienda Software A por su métrica final.\n\nSoporte es un factor discutido.',
  modelo: 'claude-haiku-5-5',
  estado: 'completado',
  respaldo: false,
  creadoEn: '2026-10-09T15:42:00.000Z',
}

function analisisApi(inicial: Analisis | null, siguiente: Analisis = { ...ANALISIS, id: 2 }) {
  let actual = inicial
  const handler: FakeHandler = ({ method, path }) => {
    if (path !== '/api/proyectos/10/analisis') return undefined
    if (method === 'GET') {
      return actual
        ? { status: 200, body: actual }
        : { status: 404, body: { statusCode: 404, message: 'Aún no hay análisis' } }
    }
    if (method === 'POST') {
      actual = siguiente
      return { status: 201, body: actual }
    }
    return undefined
  }
  return handler
}

function montar(analisis: FakeHandler) {
  const resultados = resultadosApi(10, { persistido: resultadoBase() })
  const proyectos = proyectosApi([proyecto({ id: 10, estado: 'en_curso' })], COORDINADOR)
  return renderRoute('/proyectos/10/analisis', {
    usuario: COORDINADOR,
    api: combinar(analisis, resultados.handler, proyectos.handler),
  })
}

describe('Análisis con IA (RF-16, HU-09)', () => {
  it('shows the last analysis with its model and date, and the detected flags', async () => {
    montar(analisisApi(ANALISIS))

    expect(await screen.findByText('Se recomienda Software A por su métrica final.')).toBeInTheDocument()
    expect(screen.getByText('Soporte es un factor discutido.')).toBeInTheDocument()
    expect(screen.getByText(/Modelo: claude-haiku-5-5/)).toBeInTheDocument()
    expect(screen.getByText(/Generado el 09 oct 2026/)).toBeInTheDocument()
    expect(screen.getByText('Números verificados · la IA no calcula ni decide')).toBeInTheDocument()
    expect(screen.queryByText(/Texto de respaldo/)).not.toBeInTheDocument()
    const banderas = await screen.findByRole('region', { name: 'Banderas detectadas' })
    expect(within(banderas).getByText('Software A lidera la métrica pero tiene nivel C')).toBeInTheDocument()
  })

  it('generates the first analysis', async () => {
    const user = userEvent.setup()
    const { requests } = montar(analisisApi(null))

    expect(await screen.findByText('Aún no hay análisis')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Generar análisis' }))

    expect(await screen.findByText('Se recomienda Software A por su métrica final.')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST' && r.path === '/api/proyectos/10/analisis')).toBe(true)
    expect(screen.getByRole('button', { name: 'Regenerar análisis' })).toBeInTheDocument()
  })

  it('regenerates it and warns when the fallback text was used', async () => {
    const user = userEvent.setup()
    montar(
      analisisApi(ANALISIS, {
        ...ANALISIS,
        id: 2,
        texto: 'Resumen de respaldo armado con plantillas.',
        estado: 'fallido',
        respaldo: true,
      }),
    )

    await user.click(await screen.findByRole('button', { name: 'Regenerar análisis' }))

    expect(await screen.findByText('Resumen de respaldo armado con plantillas.')).toBeInTheDocument()
    expect(screen.getByText('Texto de respaldo: el servicio de IA no estaba disponible')).toBeInTheDocument()
  })

  it('shows the server message when there are no results to analyse', async () => {
    const user = userEvent.setup()
    montar((request) =>
      request.method === 'POST' && request.path === '/api/proyectos/10/analisis'
        ? { status: 404, body: { statusCode: 404, message: 'Aún no hay resultados' } }
        : analisisApi(null)(request),
    )
    await user.click(await screen.findByRole('button', { name: 'Generar análisis' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Aún no hay resultados')
  })

  it('lists the projects I coordinate as menu entry', async () => {
    const proyectos = proyectosApi(
      [proyecto({ id: 10, nombre: 'Sistema de inventario' }), proyectoComoJurado('activo', { id: 20 })],
      COORDINADOR,
    )
    renderRoute('/evaluaciones/analisis', { usuario: COORDINADOR, api: proyectos.handler })
    expect(await screen.findByRole('link', { name: /Sistema de inventario/ })).toHaveAttribute(
      'href',
      '/proyectos/10/analisis',
    )
  })
})
