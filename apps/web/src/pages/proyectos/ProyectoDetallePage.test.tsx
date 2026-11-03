import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { COORDINADOR, INVITADO } from '../../test/fake-api'
import { conError, proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

const JURADO_ACTIVO = {
  idUsuario: 7,
  nombre: 'Luis Mora',
  email: 'luis@correo.com',
  estado: 'activo' as const,
  idDimensiones: [1, 2],
}

function abrir(proyectoBase = proyecto(), usuario = COORDINADOR, envolver = (h: ReturnType<typeof proyectosApi>['handler']) => h) {
  const api = proyectosApi([proyectoBase], usuario)
  const rendered = renderRoute(`/proyectos/${proyectoBase.id}`, {
    usuario,
    api: envolver(api.handler),
  })
  return { ...rendered, ...api }
}

describe('ProyectoDetallePage as coordinator', () => {
  it('shows the project data, softwares and judges', async () => {
    abrir(proyecto({ estado: 'en_curso', jurados: [JURADO_ACTIVO] }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sistema de inventario' }),
    ).toBeInTheDocument()
    const principal = within(screen.getByRole('main'))
    expect(principal.getByText('En curso')).toBeInTheDocument()
    expect(principal.getByText('Alcaldía Norte')).toBeInTheDocument()
    expect(principal.getByText('Mediana')).toBeInTheDocument()
    expect(principal.getByText('08 oct 2026')).toBeInTheDocument()
    expect(principal.getByText('Tecnológica, Organizacional')).toBeInTheDocument()
    expect(principal.getByText('Software A')).toBeInTheDocument()
    expect(principal.getByText('Versión 2.1 · Licencia libre')).toBeInTheDocument()
    const fila = principal.getByRole('row', { name: /Luis Mora/ })
    expect(within(fila).getByText('luis@correo.com')).toBeInTheDocument()
    expect(within(fila).getByText('Activo')).toBeInTheDocument()
  })

  it('adds a software and sends only the filled fields', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    await user.type(await screen.findByLabelText('Nombre del software'), 'Software B')
    await user.type(screen.getByLabelText('Versión'), '5.0')
    await user.click(screen.getByRole('button', { name: 'Agregar software' }))

    expect(await screen.findByText('Software B')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({
      method: 'POST',
      path: '/api/proyectos/10/softwares',
      body: { nombre: 'Software B', version: '5.0' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Software agregado')
    expect(screen.getByLabelText('Nombre del software')).toHaveValue('')
  })

  it('removes a software while the project is a draft', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    await user.click(await screen.findByRole('button', { name: 'Quitar software Software A' }))
    await screen.findByText('Este proyecto aún no tiene softwares')
    expect(requests.at(-1)).toMatchObject({
      method: 'DELETE',
      path: '/api/proyectos/10/softwares/100',
    })
    expect(screen.getByRole('status')).toHaveTextContent('Software quitado')
  })

  it('does not offer to remove softwares once the project is running', async () => {
    abrir(proyecto({ estado: 'en_curso' }))
    await screen.findByText('Software A')
    expect(screen.queryByRole('button', { name: 'Quitar software Software A' })).not.toBeInTheDocument()
  })

  it('invites a judge by e-mail and removes them', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    await user.type(await screen.findByLabelText('Correo del jurado'), 'luis@correo.com')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await user.click(await screen.findByRole('button', { name: 'Invitar' }))

    const fila = await screen.findByRole('row', { name: /Luis Mora/ })
    expect(within(fila).getByText('Invitado')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({
      method: 'POST',
      path: '/api/proyectos/10/jurados',
      body: { idUsuario: 7 },
    })
    expect(requests.some((request) => request.path === '/api/usuarios/buscar' && request.search === '?email=luis%40correo.com')).toBe(true)

    await user.click(within(fila).getByRole('button', { name: 'Quitar jurado Luis Mora' }))
    await screen.findByText('Este proyecto aún no tiene jurados')
    expect(requests.at(-1)).toMatchObject({ method: 'DELETE', path: '/api/proyectos/10/jurados/7' })
  })

  it('adds the coordinator as a judge (single-judge mode)', async () => {
    const user = userEvent.setup()
    abrir()
    await user.click(await screen.findByRole('button', { name: 'Agregarme como jurado' }))
    const fila = await within(screen.getByRole('main')).findByRole('row', { name: /Edna Lee/ })
    expect(within(fila).getByText('Activo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregarme como jurado' })).not.toBeInTheDocument()
  })

  it('finishes an active judge', async () => {
    const user = userEvent.setup()
    const { requests } = abrir(proyecto({ estado: 'en_curso', jurados: [JURADO_ACTIVO] }))
    await user.click(await screen.findByRole('button', { name: 'Finalizar jurado Luis Mora' }))
    expect(await screen.findByText('Finalizado')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({
      method: 'PATCH',
      path: '/api/proyectos/10/jurados/7',
      body: { estado: 'finalizado' },
    })
  })

  it('starts the evaluation and shows the server reason when it is not possible', async () => {
    const user = userEvent.setup()
    const fallido = abrir(proyecto(), COORDINADOR, (handler) =>
      conError(handler, (method, path) => method === 'POST' && path.endsWith('/estado'), 409, 'Agrega al menos un jurado'),
    )
    await user.click(await screen.findByRole('button', { name: 'Iniciar evaluación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Agrega al menos un jurado')
    expect(fallido.proyectos[0]!.estado).toBe('borrador')
  })

  it('starts the evaluation when the project is ready', async () => {
    const user = userEvent.setup()
    const { requests } = abrir(proyecto({ jurados: [JURADO_ACTIVO] }))
    await user.click(await screen.findByRole('button', { name: 'Iniciar evaluación' }))
    expect(await screen.findByRole('status')).toHaveTextContent('La evaluación está en curso')
    expect(requests.at(-1)).toMatchObject({
      method: 'POST',
      path: '/api/proyectos/10/estado',
      body: { estado: 'en_curso' },
    })
    expect(screen.queryByRole('button', { name: 'Iniciar evaluación' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar proyecto' })).toBeInTheDocument()
  })

  it('is read-only once the project is closed', async () => {
    abrir(proyecto({ estado: 'cerrado', jurados: [JURADO_ACTIVO] }))
    await screen.findByText('Software A')
    for (const nombre of ['Agregar software', 'Buscar', 'Cerrar proyecto', 'Iniciar evaluación']) {
      expect(screen.queryByRole('button', { name: nombre })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Quitar jurado Luis Mora' })).not.toBeInTheDocument()
  })

  it('shows the server message when a write fails', async () => {
    const user = userEvent.setup()
    abrir(proyecto(), COORDINADOR, (handler) =>
      conError(handler, (method, path) => method === 'POST' && path.endsWith('/softwares'), 409, 'El proyecto está cerrado'),
    )
    await user.type(await screen.findByLabelText('Nombre del software'), 'Software B')
    await user.click(screen.getByRole('button', { name: 'Agregar software' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El proyecto está cerrado')
  })

  it('shows the server message when the project is not visible', async () => {
    const api = proyectosApi([], COORDINADOR)
    renderRoute('/proyectos/99', { usuario: COORDINADOR, api: api.handler })
    expect(await screen.findByRole('alert')).toHaveTextContent('Proyecto no encontrado')
  })
})

describe('ProyectoDetallePage as judge', () => {
  it('is read-only and links to the evaluation for an active judge', async () => {
    abrir(proyectoComoJurado('activo'), INVITADO)
    expect(await screen.findByRole('heading', { level: 1, name: 'Portal académico' })).toBeInTheDocument()
    expect(screen.getByText('Tu estado como jurado: Activo')).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Calificar factores' }),
    ).toHaveAttribute(
      'href',
      '/proyectos/20/importancia',
    )
    for (const nombre of ['Agregar software', 'Buscar', 'Iniciar evaluación', 'Cerrar proyecto']) {
      expect(screen.queryByRole('button', { name: nombre })).not.toBeInTheDocument()
    }
  })

  it('does not link to the evaluation while the request is pending', async () => {
    abrir(proyectoComoJurado('invitado'), INVITADO)
    expect(await screen.findByText('Tu estado como jurado: Invitado')).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).queryByRole('link', { name: 'Calificar factores' }),
    ).not.toBeInTheDocument()
  })
})
