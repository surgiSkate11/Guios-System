import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { COORDINADOR, INVITADO, type FakeHandler } from '../../test/fake-api'
import { combinar } from '../../test/evaluacion-api'
import { conError, proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'
import { resultadoBase, resultadosApi } from '../../test/resultados-api'

const SOFTWARES = [
  { id: 100, nombre: 'Software A', version: null, licencia: null },
  { id: 101, nombre: 'Software B', version: null, licencia: null },
]

function comoCoordinador(path: string, extra?: FakeHandler, persistido = resultadoBase()) {
  const resultados = resultadosApi(10, { persistido })
  const proyectos = proyectosApi([proyecto({ id: 10, estado: 'en_curso', softwares: SOFTWARES })], COORDINADOR)
  const base = combinar(resultados.handler, proyectos.handler)
  const api = extra ? combinar(extra, base) : base
  return { resultados, ...renderRoute(path, { usuario: COORDINADOR, api }) }
}

describe('Paso 5 y 6: resultado', () => {
  it('shows the judge their own score, PM and SWOT per software', async () => {
    const user = userEvent.setup()
    const resultados = resultadosApi(20)
    const proyectos = proyectosApi([proyectoComoJurado('activo', { softwares: SOFTWARES })], INVITADO)
    renderRoute('/proyectos/20/resultado', { usuario: INVITADO, api: combinar(resultados.handler, proyectos.handler) })

    const tabla = await screen.findByRole('table', { name: 'Análisis FODA por factor' })
    expect(within(tabla).getByRole('row', { name: /Compatibilidad/ })).toHaveTextContent('3.0 / 4Fortaleza')
    expect(within(tabla).getByRole('row', { name: /Soporte/ })).toHaveTextContent('—')
    expect(screen.getByRole('heading', { name: 'Tu métrica' })).toBeInTheDocument()
    expect(screen.getByTestId('metrica')).toHaveTextContent('78.2')

    await user.click(screen.getByRole('tab', { name: 'Software B' }))
    expect(screen.getByRole('table', { name: 'Análisis FODA por factor' })).toHaveTextContent('Debilidad')
    expect(screen.getByTestId('metrica')).toHaveTextContent('—')
  })

  it('shows the coordinator the consolidated result with metric, spread and level', async () => {
    comoCoordinador('/proyectos/10/resultado')

    const tabla = await screen.findByRole('table', { name: 'Análisis FODA por factor' })
    expect(within(tabla).getByRole('row', { name: /Soporte/ })).toHaveTextContent('2.0 / 4ExternoAmenaza')
    expect(screen.getByTestId('metrica')).toHaveTextContent('72.3')
    expect(screen.getByText('Nivel de adopción C')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Mínimo' })).toHaveTextContent('66.4')
    expect(screen.getByRole('group', { name: 'Máximo' })).toHaveTextContent('78.2')
    expect(screen.getByRole('group', { name: 'Desviación' })).toHaveTextContent('4.1')
  })

  it('tells the coordinator to generate the results first', async () => {
    comoCoordinador('/proyectos/10/resultado', undefined, null as never)
    expect(await screen.findByText('Aún no hay resultados')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a la comparación' })).toHaveAttribute(
      'href',
      '/proyectos/10/comparacion',
    )
  })
})

describe('Comparación de softwares (HU-07, HU-08)', () => {
  it('ranks the softwares with metric, spread, level and SWOT summary', async () => {
    comoCoordinador('/proyectos/10/comparacion')

    const ranking = await screen.findByRole('table', { name: 'Ranking de softwares' })
    const filas = within(ranking).getAllByRole('row').slice(1)
    expect(filas.map((fila) => within(fila).getAllByRole('cell').map((celda) => celda.textContent))).toEqual([
      ['1°', 'Software A', '72.3', '66.4', '78.2', '4.1', 'Nivel C', 'F 1D 0O 0A 1'],
      ['2°', 'Software B', '70.0', '62.0', '76.5', '5.0', 'Nivel B', 'F 1D 0O 0A 0'],
    ])
    expect(screen.getByText('Vista previa: los resultados todavía no se generaron')).toBeInTheDocument()
  })

  it('shows the metric of each judge and the ambiguity flags', async () => {
    comoCoordinador('/proyectos/10/comparacion')

    const porJurado = await screen.findByRole('region', { name: 'Métrica final por jurado' })
    const softwareA = within(porJurado).getByRole('group', { name: 'Software A' })
    expect(within(softwareA).getByRole('meter', { name: 'Ana Pérez' })).toHaveAttribute('aria-valuenow', '78.2')
    const softwareB = within(porJurado).getByRole('group', { name: 'Software B' })
    expect(within(softwareB).getByText('Sin métrica')).toBeInTheDocument()

    const banderas = screen.getByRole('region', { name: 'Banderas de ambigüedad' })
    expect(within(banderas).getByText('Software A lidera la métrica pero tiene nivel C')).toBeInTheDocument()
    expect(within(banderas).getByText('Soporte supera el umbral de 2')).toBeInTheDocument()
    expect(within(banderas).getByText('Empate técnico')).toHaveAttribute('data-detectada', 'false')
    expect(within(banderas).getByText('Métrica contra nivel')).toHaveAttribute('data-detectada', 'true')
  })

  it('generates the results and shows when they were generated', async () => {
    const user = userEvent.setup()
    const { requests, resultados } = comoCoordinador('/proyectos/10/comparacion', undefined, null as never)
    await screen.findByRole('table', { name: 'Ranking de softwares' })

    await user.click(screen.getByRole('button', { name: 'Generar resultados' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Resultados generados')
    expect(requests.some((r) => r.method === 'POST' && r.path === '/api/proyectos/10/resultados')).toBe(true)
    expect(resultados.estado.persistido).not.toBeNull()
    expect(screen.getByText(/Generado el 09 oct 2026/)).toBeInTheDocument()
  })

  it('shows how many relevant factors are missing (RF-13)', async () => {
    const faltan: FakeHandler = ({ method, path }) =>
      method === 'GET' && path === '/api/proyectos/10/resultados/vista-previa'
        ? { status: 409, body: { statusCode: 409, message: 'Faltan 2 factores relevantes por evaluar', faltantes: 2 } }
        : undefined
    comoCoordinador('/proyectos/10/comparacion', faltan)

    expect(await screen.findByRole('alert')).toHaveTextContent('Faltan 2 factores relevantes por evaluar')
    expect(screen.queryByRole('table', { name: 'Ranking de softwares' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar resultados' })).not.toBeInTheDocument()
  })

  it('lists the projects I coordinate as menu entry', async () => {
    const proyectos = proyectosApi(
      [proyecto({ id: 10, nombre: 'Sistema de inventario' }), proyectoComoJurado('activo', { id: 20 })],
      COORDINADOR,
    )
    renderRoute('/evaluaciones/comparacion', { usuario: COORDINADOR, api: proyectos.handler })
    expect(await screen.findByRole('link', { name: /Sistema de inventario/ })).toHaveAttribute(
      'href',
      '/proyectos/10/comparacion',
    )
    expect(screen.queryByText('Portal académico')).not.toBeInTheDocument()
  })
})

describe('Auditoría de jurados (HU-13)', () => {
  it('shows each judge with state, Desconozco share and score per software', async () => {
    comoCoordinador('/proyectos/10/auditoria')

    const tabla = await screen.findByRole('table', { name: 'Jurados del proyecto' })
    expect(within(tabla).getByRole('columnheader', { name: 'Software A' })).toBeInTheDocument()
    const luis = within(tabla).getByRole('row', { name: /Luis Mora/ })
    expect(within(luis).getAllByRole('cell').map((celda) => celda.textContent)).toEqual([
      'Activo',
      '1 de 2',
      '4',
      '2 (50.0 %)',
      '66.4',
      '—',
    ])
  })

  it('compares the importances of every judge per factor', async () => {
    comoCoordinador('/proyectos/10/auditoria')

    const tabla = await screen.findByRole('table', { name: 'Importancias por jurado' })
    const soporte = within(tabla).getByRole('row', { name: /Soporte/ })
    expect(within(soporte).getAllByRole('cell').map((celda) => celda.textContent)).toEqual(['4', '—'])
  })

  it('shows the server message when the audit cannot be loaded', async () => {
    const proyectos = proyectosApi([proyecto({ id: 10 })], COORDINADOR)
    const api = conError(
      proyectos.handler,
      (method, path) => method === 'GET' && path === '/api/proyectos/10/auditoria',
      404,
      'Proyecto no encontrado',
    )
    renderRoute('/proyectos/10/auditoria', { usuario: COORDINADOR, api })
    expect(await screen.findByRole('alert')).toHaveTextContent('Proyecto no encontrado')
  })
})
