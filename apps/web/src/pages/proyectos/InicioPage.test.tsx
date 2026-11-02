import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ADMINISTRADOR, COORDINADOR, INVITADO, TEST_TOKEN } from '../../test/fake-api'
import {
  conError,
  proyecto,
  proyectoComoJurado,
  proyectosApi,
} from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

const PROYECTOS = [
  proyecto({
    id: 10,
    nombre: 'Sistema de inventario',
    estado: 'en_curso',
    jurados: [
      { idUsuario: 7, nombre: 'Luis Mora', email: 'luis@correo.com', estado: 'activo', idDimensiones: [1] },
      { idUsuario: 8, nombre: 'Ana Ruiz', email: 'ana@correo.com', estado: 'invitado', idDimensiones: [1] },
    ],
  }),
  proyecto({ id: 11, nombre: 'Portal de pagos', estado: 'cerrado', fechaInicio: '2026-09-14' }),
  proyecto({ id: 12, nombre: 'App de salud', estado: 'borrador' }),
]

function valorDe(nombre: string) {
  return within(screen.getByRole('group', { name: nombre }))
}

describe('InicioPage', () => {
  it('summarizes the coordinator projects with counters and a recent projects table', async () => {
    const { handler } = proyectosApi(PROYECTOS, COORDINADOR)
    renderRoute('/inicio', { usuario: COORDINADOR, api: handler })

    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Sistema de inventario' })).toHaveAttribute(
      'href',
      '/proyectos/10',
    )
    expect(valorDe('Proyectos en curso').getByText('1')).toBeInTheDocument()
    expect(valorDe('Evaluaciones cerradas').getByText('1')).toBeInTheDocument()
    expect(valorDe('Jurados activos').getByText('1')).toBeInTheDocument()
    expect(valorDe('Softwares candidatos').getByText('3')).toBeInTheDocument()

    const tabla = screen.getByRole('table', { name: 'Proyectos recientes' })
    const fila = within(tabla).getByRole('row', { name: /Portal de pagos/ })
    expect(within(fila).getByText('Alcaldía Norte')).toBeInTheDocument()
    expect(within(fila).getByText('Cerrado')).toBeInTheDocument()
    expect(within(fila).getByText('14 sep 2026')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Nuevo proyecto' })).toHaveAttribute(
      'href',
      '/proyectos/nuevo',
    )
  })

  it('does not offer a new project to a user that is not a coordinator', async () => {
    const { handler } = proyectosApi([proyectoComoJurado('activo')], INVITADO)
    renderRoute('/inicio', { usuario: INVITADO, api: handler })
    expect(await screen.findByRole('link', { name: 'Portal académico' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Nuevo proyecto' })).not.toBeInTheDocument()
  })

  it('lists the judge requests and accepts one', async () => {
    const user = userEvent.setup()
    const { handler, proyectos } = proyectosApi([proyectoComoJurado('invitado')], INVITADO)
    const { requests } = renderRoute('/inicio', { usuario: INVITADO, api: handler })

    const solicitud = await screen.findByRole('listitem', { name: 'Solicitud de Portal académico' })
    expect(within(solicitud).getByText('Coordina: Rosa Vega')).toBeInTheDocument()
    await user.click(within(solicitud).getByRole('button', { name: 'Aceptar' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Aceptaste la solicitud de Portal académico',
    )
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/api/proyectos/20/solicitud/aceptar',
        headers: expect.objectContaining({ authorization: `Bearer ${TEST_TOKEN}` }),
      }),
    )
    expect(proyectos[0]!.miEstadoJurado).toBe('activo')
    expect(screen.queryByRole('listitem', { name: 'Solicitud de Portal académico' })).not.toBeInTheDocument()
    expect(screen.getByText('No tienes solicitudes pendientes')).toBeInTheDocument()
  })

  it('rejects a request, which removes the project from the user view', async () => {
    const user = userEvent.setup()
    const { handler } = proyectosApi([proyectoComoJurado('invitado')], INVITADO)
    const { requests } = renderRoute('/inicio', { usuario: INVITADO, api: handler })

    const solicitud = await screen.findByRole('listitem', { name: 'Solicitud de Portal académico' })
    await user.click(within(solicitud).getByRole('button', { name: 'Rechazar' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Rechazaste la solicitud de Portal académico',
    )
    expect(requests).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/api/proyectos/20/solicitud/rechazar' }),
    )
    expect(screen.queryByRole('link', { name: 'Portal académico' })).not.toBeInTheDocument()
  })

  it('shows the server message when answering a request fails', async () => {
    const user = userEvent.setup()
    const { handler } = proyectosApi([proyectoComoJurado('invitado')], INVITADO)
    const fallido = conError(
      handler,
      (method, path) => method === 'POST' && path.endsWith('/solicitud/aceptar'),
      409,
      'El proyecto está cerrado',
    )
    renderRoute('/inicio', { usuario: INVITADO, api: fallido })

    const solicitud = await screen.findByRole('listitem', { name: 'Solicitud de Portal académico' })
    await user.click(within(solicitud).getByRole('button', { name: 'Aceptar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El proyecto está cerrado')
    expect(screen.getByRole('listitem', { name: 'Solicitud de Portal académico' })).toBeInTheDocument()
  })

  it('shows the load error of the projects', async () => {
    const { handler } = proyectosApi([], COORDINADOR)
    const fallido = conError(handler, (_m, path) => path === '/api/proyectos', 500, 'Error interno')
    renderRoute('/inicio', { usuario: COORDINADOR, api: fallido })
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno')
  })

  it('gives the administrator a pointer to the admin screens instead of projects', async () => {
    const { requests } = renderRoute('/inicio', { usuario: ADMINISTRADOR })
    const principal = within(await screen.findByRole('main'))
    expect(await principal.findByRole('link', { name: 'Configuración' })).toHaveAttribute(
      'href',
      '/admin/configuracion',
    )
    expect(screen.queryByRole('table', { name: 'Proyectos recientes' })).not.toBeInTheDocument()
    expect(requests.some((request) => /proyectos|solicitudes/.test(request.path))).toBe(false)
  })
})
