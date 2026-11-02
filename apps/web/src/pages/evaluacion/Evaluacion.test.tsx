import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { INVITADO } from '../../test/fake-api'
import { combinar, evaluacionApi } from '../../test/evaluacion-api'
import { conError, proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

const SOFTWARES = [
  { id: 100, nombre: 'Software A', version: null, licencia: null },
  { id: 101, nombre: 'Software B', version: null, licencia: null },
]

function montar(path: string, estadoProyecto: 'en_curso' | 'cerrado' = 'en_curso') {
  const proyectoJurado = proyectoComoJurado('activo', { softwares: SOFTWARES, estado: estadoProyecto })
  const proyectos = proyectosApi([proyectoJurado, proyecto({ id: 10 })], INVITADO)
  const evaluacion = evaluacionApi(20, SOFTWARES)
  const api = combinar(evaluacion.handler, proyectos.handler)
  return { api, evaluacion, ...renderRoute(path, { usuario: INVITADO, api }) }
}

describe('Calificar factores (project picker)', () => {
  it('lists only the projects where the user is an active judge', async () => {
    const proyectos = proyectosApi(
      [
        proyectoComoJurado('activo', { id: 20, nombre: 'Portal académico' }),
        proyectoComoJurado('invitado', { id: 21, nombre: 'Gestión documental' }),
      ],
      INVITADO,
    )
    renderRoute('/evaluaciones/calificar', { usuario: INVITADO, api: proyectos.handler })

    const enlace = await screen.findByRole('link', { name: /Portal académico/ })
    expect(enlace).toHaveAttribute('href', '/proyectos/20/importancia')
    expect(screen.queryByText('Gestión documental')).not.toBeInTheDocument()
  })

  it('explains when there is nothing to rate', async () => {
    const proyectos = proyectosApi([], INVITADO)
    renderRoute('/evaluaciones/calificar', { usuario: INVITADO, api: proyectos.handler })
    expect(
      await screen.findByText('No tenés proyectos activos como jurado.'),
    ).toBeInTheDocument()
  })
})

describe('Paso 1 y 2: importancia (HU-02)', () => {
  it('shows the project header, the step tabs and my factors with their suggested importance', async () => {
    montar('/proyectos/20/importancia')

    expect(await screen.findByRole('heading', { level: 1, name: 'Portal académico' })).toBeInTheDocument()
    expect(screen.getByText('Evaluando como jurado: Ana Pérez')).toBeInTheDocument()
    const pasos = screen.getByRole('navigation', { name: 'Pasos de la evaluación' })
    expect(within(pasos).getByRole('link', { name: 'Paso 1 y 2. Obtención de factores relevantes' })).toHaveAttribute('aria-current', 'page')
    expect(within(pasos).getByRole('link', { name: 'Paso 3 y 4. Obtención de factores ponderados' })).toHaveAttribute('href', '/proyectos/20/subfactores')

    const fila = await screen.findByRole('row', { name: /Compatibilidad/ })
    expect(within(fila).getByText('Tecnológica')).toBeInTheDocument()
    expect(within(fila).getByText('Importante', { selector: '[data-sugerida]' })).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Importante' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 de 2 factores evaluados')).toBeInTheDocument()
  })

  it('saves an importance on click without another action', async () => {
    const user = userEvent.setup()
    const { requests, evaluacion } = montar('/proyectos/20/importancia')
    const fila = await screen.findByRole('row', { name: /Soporte/ })

    await user.click(within(fila).getByRole('button', { name: 'Fundamental' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Importancia de Soporte guardada')
    expect(requests.find((r) => r.method === 'PUT')).toMatchObject({
      path: '/api/proyectos/20/importancias/502',
      body: { impDecisor: 4 },
    })
    expect(within(fila).getByRole('button', { name: 'Fundamental' })).toHaveAttribute('aria-pressed', 'true')
    expect(evaluacion.importancias[1]!.impDecisor).toBe(4)
    expect(screen.getByText('2 de 2 factores evaluados')).toBeInTheDocument()
  })

  it('shows the server message and restores the previous value when saving fails', async () => {
    const user = userEvent.setup()
    const proyectoJurado = proyectoComoJurado('activo', { softwares: SOFTWARES })
    const evaluacion = evaluacionApi(20, SOFTWARES)
    const api = conError(
      combinar(evaluacion.handler, proyectosApi([proyectoJurado], INVITADO).handler),
      (method, path) => method === 'PUT' && path.startsWith('/api/proyectos/20/importancias/'),
      409,
      'La consolidación ya fue confirmada',
    )
    renderRoute('/proyectos/20/importancia', { usuario: INVITADO, api })
    const fila = await screen.findByRole('row', { name: /Compatibilidad/ })

    await user.click(within(fila).getByRole('button', { name: 'Irrelevante' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La consolidación ya fue confirmada')
    expect(within(fila).getByRole('button', { name: 'Importante' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(fila).getByRole('button', { name: 'Irrelevante' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('tells an invited judge to accept the request first (403)', async () => {
    const proyectoJurado = proyectoComoJurado('invitado', { softwares: SOFTWARES })
    const api = conError(
      proyectosApi([proyectoJurado], INVITADO).handler,
      (method, path) => method === 'GET' && path === '/api/proyectos/20/importancias/mias',
      403,
      'Forbidden resource',
    )
    renderRoute('/proyectos/20/importancia', { usuario: INVITADO, api })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Aceptá la solicitud del proyecto para poder evaluar.',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('is read-only when the project is not in progress', async () => {
    montar('/proyectos/20/importancia', 'cerrado')
    const fila = await screen.findByRole('row', { name: /Soporte/ })
    expect(screen.getByText('El proyecto no está en curso: las respuestas son de solo lectura.')).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Fundamental' })).toBeDisabled()
  })
})

describe('Paso 3 y 4: calificación de subfactores (HU-05)', () => {
  it('shows the subfactors of the selected factor and software with the PM', async () => {
    montar('/proyectos/20/subfactores')

    const tabla = await screen.findByRole('table', { name: 'Subfactores de Compatibilidad · Software A' })
    const fila = within(tabla).getByRole('row', { name: /Usa formatos estándar/ })
    expect(within(fila).getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(fila).getByText('2 / 4')).toBeInTheDocument()
    expect(screen.getByText('Te falta 1 factor por evaluar')).toBeInTheDocument()
    expect(screen.getByText('Ponderación media del factor Compatibilidad (Software A)')).toBeInTheDocument()
    expect(screen.getByTestId('pm')).toHaveTextContent('2.0 / 4')
  })

  it('saves a rating immediately and updates the PM', async () => {
    const user = userEvent.setup()
    const { requests } = montar('/proyectos/20/subfactores')
    const tabla = await screen.findByRole('table', { name: /Compatibilidad/ })
    const fila = within(tabla).getByRole('row', { name: /Compatible con varios SO/ })

    await user.click(within(fila).getByRole('button', { name: '4' }))

    expect(requests.find((r) => r.method === 'PUT')).toMatchObject({
      path: '/api/proyectos/20/calificaciones',
      body: { idSoftware: 100, idSubfactor: 12, valor: 4 },
    })
    await waitFor(() => expect(screen.getByTestId('pm')).toHaveTextContent('3.0 / 4'))
    expect(screen.getByText('Todos los factores están evaluados')).toBeInTheDocument()
  })

  it('saves Desconozco, which is left out of the PM', async () => {
    const user = userEvent.setup()
    const { requests } = montar('/proyectos/20/subfactores')
    const tabla = await screen.findByRole('table', { name: /Compatibilidad/ })

    await user.click(within(tabla).getByRole('checkbox', { name: 'Desconozco: Compatible con varios SO' }))

    expect(requests.find((r) => r.method === 'PUT')).toMatchObject({
      body: { idSoftware: 100, idSubfactor: 12, desconozco: true },
    })
    const fila = within(tabla).getByRole('row', { name: /Compatible con varios SO/ })
    expect(await within(fila).findByText('Desconozco')).toBeInTheDocument()
    expect(screen.getByTestId('pm')).toHaveTextContent('2.0 / 4')
  })

  it('switches factor and software', async () => {
    const user = userEvent.setup()
    const { requests } = montar('/proyectos/20/subfactores')
    await screen.findByRole('table', { name: /Compatibilidad · Software A/ })

    await user.selectOptions(screen.getByLabelText('Factor'), 'Soporte')
    expect(screen.getByRole('table', { name: 'Subfactores de Soporte · Software A' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Software'), 'Software B')
    expect(await screen.findByRole('table', { name: /· Software B/ })).toBeInTheDocument()
    expect(requests.some((r) => r.path === '/api/proyectos/20/calificaciones/mias' && r.search === '?software=101')).toBe(true)
  })

  it('restores the previous rating and shows the server message when saving fails', async () => {
    const user = userEvent.setup()
    const proyectoJurado = proyectoComoJurado('activo', { softwares: SOFTWARES })
    const evaluacion = evaluacionApi(20, SOFTWARES)
    const api = conError(
      combinar(evaluacion.handler, proyectosApi([proyectoJurado], INVITADO).handler),
      (method, path) => method === 'PUT' && path === '/api/proyectos/20/calificaciones',
      409,
      'El proyecto ya está cerrado',
    )
    renderRoute('/proyectos/20/subfactores', { usuario: INVITADO, api })
    const tabla = await screen.findByRole('table', { name: /Compatibilidad/ })
    const fila = within(tabla).getByRole('row', { name: /Usa formatos estándar/ })

    await user.click(within(fila).getByRole('button', { name: '4' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El proyecto ya está cerrado')
    expect(within(fila).getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('pm')).toHaveTextContent('2.0 / 4')
  })

  it('shows the message when consolidation is not confirmed yet', async () => {
    const proyectoJurado = proyectoComoJurado('activo', { softwares: SOFTWARES })
    const api = conError(
      proyectosApi([proyectoJurado], INVITADO).handler,
      (method, path) => method === 'GET' && path === '/api/proyectos/20/calificaciones/mias',
      409,
      'Primero se debe confirmar la consolidación',
    )
    renderRoute('/proyectos/20/subfactores', { usuario: INVITADO, api })
    expect(await screen.findByRole('alert')).toHaveTextContent('Primero se debe confirmar la consolidación')
  })
})
