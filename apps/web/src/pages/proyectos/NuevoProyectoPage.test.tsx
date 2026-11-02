import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { COORDINADOR } from '../../test/fake-api'
import { conError, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

type Usuario = ReturnType<typeof userEvent.setup>

function abrir(api = proyectosApi([], COORDINADOR).handler) {
  return renderRoute('/proyectos/nuevo', { usuario: COORDINADOR, api })
}

async function llenarDatos(user: Usuario) {
  await user.type(await screen.findByLabelText('Nombre del proyecto'), 'Sistema de inventario')
  await user.type(screen.getByLabelText('Fecha de inicio'), '2026-10-08')
  await user.click(await screen.findByRole('checkbox', { name: 'Tecnológica' }))
  await user.click(screen.getByRole('checkbox', { name: 'Organizacional' }))
}

async function agregarSoftware(user: Usuario, nombre: string, version = '', licencia = '') {
  await user.type(screen.getByLabelText('Nombre del software'), nombre)
  if (version) await user.type(screen.getByLabelText('Versión'), version)
  if (licencia) await user.type(screen.getByLabelText('Licencia'), licencia)
  await user.click(screen.getByRole('button', { name: 'Agregar software' }))
}

describe('NuevoProyectoPage', () => {
  it('shows the three steps and starts on the project data', async () => {
    abrir()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nuevo proyecto de evaluación' }),
    ).toBeInTheDocument()
    const pasos = within(screen.getByRole('list', { name: 'Pasos' })).getAllByRole('listitem')
    expect(pasos.map((paso) => paso.textContent)).toEqual([
      expect.stringContaining('Datos'),
      expect.stringContaining('Softwares candidatos'),
      expect.stringContaining('Jurados'),
    ])
    expect(pasos[0]).toHaveAttribute('aria-current', 'step')
    expect(await screen.findByRole('checkbox', { name: 'Tecnológica' })).toBeInTheDocument()
  })

  it('requires a name, a start date and one dimension before moving on', async () => {
    const user = userEvent.setup()
    abrir()
    await screen.findByRole('checkbox', { name: 'Tecnológica' })
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del proyecto')
    await user.type(screen.getByLabelText('Nombre del proyecto'), 'Proyecto')
    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-10-08')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Elige al menos una dimensión')
    expect(screen.queryByLabelText('Nombre del software')).not.toBeInTheDocument()
  })

  it('starts with the consolidation method of the system parameters', async () => {
    const { handler } = proyectosApi([], COORDINADOR)
    abrir((request) =>
      request.method === 'GET' && request.path === '/api/parametros'
        ? { status: 200, body: { metodoConsolidacion: 'promedio' } }
        : handler(request),
    )
    await waitFor(() => expect(screen.getByLabelText('Método de consolidación')).toHaveValue('promedio'))
  })

  it('falls back to the median when the parameters cannot be read', async () => {
    abrir()
    await screen.findByRole('checkbox', { name: 'Tecnológica' })
    expect(screen.getByLabelText('Método de consolidación')).toHaveValue('mediana')
  })

  it('shows the server message when the dimensions cannot be loaded', async () => {
    const { handler } = proyectosApi([], COORDINADOR)
    abrir(
      conError(handler, (_m, path) => path === '/api/catalogo/vigente', 404, 'No hay un catálogo cargado'),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay un catálogo cargado')
  })

  it('requires one software before creating the project', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    await llenarDatos(user)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Agrega al menos un software')
    expect(requests.some((request) => request.method === 'POST')).toBe(false)
  })

  it('keeps the data when going back from the softwares step', async () => {
    const user = userEvent.setup()
    abrir()
    await llenarDatos(user)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByLabelText('Nombre del proyecto')).toHaveValue('Sistema de inventario')
    expect(screen.getByRole('checkbox', { name: 'Organizacional' })).toBeChecked()
  })

  it('creates the project with the contract body and then manages the judges', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    await llenarDatos(user)
    await user.selectOptions(screen.getByLabelText('Método de consolidación'), 'promedio')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    await agregarSoftware(user, 'Software A', '2.1', 'libre')
    await agregarSoftware(user, 'Software B')
    expect(screen.getByText('Software A')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar Software B' }))
    expect(screen.queryByText('Software B')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Jurados' })).toBeInTheDocument()
    expect(requests.filter((request) => request.method === 'POST')).toEqual([
      expect.objectContaining({
        path: '/api/proyectos',
        body: {
          nombre: 'Sistema de inventario',
          fechaInicio: '2026-10-08',
          metodoConsolidacion: 'promedio',
          idDimensiones: [1, 2],
          softwares: [{ nombre: 'Software A', version: '2.1', licencia: 'libre' }],
        },
      }),
    ])
    expect(screen.getByRole('status')).toHaveTextContent('Proyecto creado')
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Correo del jurado'), 'luis@correo.com')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('Luis Mora (luis@correo.com)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Invitar' }))
    expect(await screen.findByText('Luis Mora')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({
      method: 'POST',
      path: '/api/proyectos/500/jurados',
      body: { idUsuario: 7 },
    })

    await user.click(screen.getByRole('button', { name: 'Agregarme como jurado' }))
    expect(await within(screen.getByRole('main')).findByText('Edna Lee')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({ path: '/api/proyectos/500/jurados', body: { idUsuario: 2 } })

    await user.click(screen.getByRole('link', { name: 'Ir al proyecto' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Sistema de inventario' })).toBeInTheDocument()
  }, 15_000) // Many typed steps; the default 5 s timeout flakes when the whole suite runs in parallel.

  it('shows every server validation message and stays on the softwares step', async () => {
    const user = userEvent.setup()
    const { handler } = proyectosApi([], COORDINADOR)
    abrir(
      conError(handler, (method, path) => method === 'POST' && path === '/api/proyectos', 400, [
        'nombre no puede estar vacío',
        'fechaInicio inválida',
      ]),
    )
    await llenarDatos(user)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await agregarSoftware(user, 'Software A')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'nombre no puede estar vacío. fechaInicio inválida',
    )
    expect(screen.getByLabelText('Nombre del software')).toBeInTheDocument()
  })

  it('shows the server message when the judge cannot be found', async () => {
    const user = userEvent.setup()
    abrir()
    await llenarDatos(user)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await agregarSoftware(user, 'Software A')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.type(await screen.findByLabelText('Correo del jurado'), 'nadie@correo.com')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No existe un usuario activo con ese correo',
    )
    expect(screen.queryByRole('button', { name: 'Invitar' })).not.toBeInTheDocument()
  })
})
