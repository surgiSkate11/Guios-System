import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { COORDINADOR, INVITADO } from '../../test/fake-api'
import { conError, proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

const PROYECTOS = [
  proyecto({
    id: 10,
    nombre: 'Sistema de inventario',
    estado: 'en_curso',
    metodoConsolidacion: 'promedio',
    softwares: [
      { id: 1, nombre: 'Odoo', version: null, licencia: null },
      { id: 2, nombre: 'Dolibarr', version: null, licencia: null },
      { id: 3, nombre: 'Alfresco', version: null, licencia: null },
    ],
    jurados: [
      { idUsuario: 7, nombre: 'Luis Mora', email: 'luis@correo.com', estado: 'activo', idDimensiones: [1] },
    ],
  }),
  proyecto({ id: 11, nombre: 'Portal de pagos', estado: 'cerrado' }),
  proyecto({ id: 12, nombre: 'App de salud', estado: 'borrador' }),
]

describe('EvaluacionesPage', () => {
  it('lists the projects with softwares, judges, method, catalog version and state', async () => {
    const { handler } = proyectosApi(PROYECTOS, COORDINADOR)
    renderRoute('/evaluaciones', { usuario: COORDINADOR, api: handler })

    const tabla = await screen.findByRole('table', { name: 'Mis evaluaciones' })
    const fila = within(tabla).getByRole('row', { name: /Sistema de inventario/ })
    expect(within(fila).getByText('Alcaldía Norte')).toBeInTheDocument()
    expect(within(fila).getByText('Odoo')).toBeInTheDocument()
    expect(within(fila).getByText('Dolibarr')).toBeInTheDocument()
    expect(within(fila).getByText('+1')).toBeInTheDocument()
    expect(within(fila).getByText('1 jurado')).toBeInTheDocument()
    expect(within(fila).getByText('Promedio')).toBeInTheDocument()
    expect(within(fila).getByText('Versión 1')).toBeInTheDocument()
    expect(within(fila).getByText('En curso')).toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: 'Abrir Sistema de inventario' })).toHaveAttribute(
      'href',
      '/proyectos/10',
    )
    expect(screen.getByText('Mostrando 3 de 3')).toBeInTheDocument()
  })

  it('filters the projects by state with the tabs', async () => {
    const user = userEvent.setup()
    const { handler } = proyectosApi(PROYECTOS, COORDINADOR)
    renderRoute('/evaluaciones', { usuario: COORDINADOR, api: handler })
    await screen.findByRole('table', { name: 'Mis evaluaciones' })

    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Borrador' }))

    const tabla = screen.getByRole('table', { name: 'Mis evaluaciones' })
    expect(within(tabla).getByText('App de salud')).toBeInTheDocument()
    expect(within(tabla).queryByText('Portal de pagos')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 3')).toBeInTheDocument()
  })

  it('tells when a state has no projects', async () => {
    const user = userEvent.setup()
    const { handler } = proyectosApi([PROYECTOS[0]!], COORDINADOR)
    renderRoute('/evaluaciones', { usuario: COORDINADOR, api: handler })
    await user.click(await screen.findByRole('tab', { name: 'Cerrado' }))
    expect(screen.getByText('No hay proyectos en este estado')).toBeInTheDocument()
  })

  it('shows the judge the projects where they were invited, without the new project button', async () => {
    const { handler } = proyectosApi([proyectoComoJurado('activo')], INVITADO)
    renderRoute('/evaluaciones', { usuario: INVITADO, api: handler })
    expect(await screen.findByText('Portal académico')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByRole('link', { name: 'Nuevo proyecto' })).not.toBeInTheDocument()
  })

  it('offers a new project to the coordinator', async () => {
    const { handler } = proyectosApi([], COORDINADOR)
    renderRoute('/evaluaciones', { usuario: COORDINADOR, api: handler })
    expect(await screen.findByText('Aún no tienes proyectos')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Nuevo proyecto' })).toHaveAttribute(
      'href',
      '/proyectos/nuevo',
    )
  })

  it('shows the server message when the projects cannot be loaded', async () => {
    const { handler } = proyectosApi([], COORDINADOR)
    renderRoute('/evaluaciones', {
      usuario: COORDINADOR,
      api: conError(handler, (_m, path) => path === '/api/proyectos', 500, 'Error interno'),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno')
  })
})
