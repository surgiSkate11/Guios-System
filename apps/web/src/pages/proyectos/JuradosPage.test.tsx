import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { COORDINADOR } from '../../test/fake-api'
import { conError, proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

const jurado = (idUsuario: number, nombre: string, estado: 'invitado' | 'activo' | 'finalizado') => ({
  idUsuario,
  nombre,
  email: `${nombre.split(' ')[0]!.toLowerCase()}@correo.com`,
  estado,
  idDimensiones: [1],
})

describe('JuradosPage', () => {
  it('lists the judges of the projects the user coordinates, with counters', async () => {
    const { handler } = proyectosApi(
      [
        proyecto({
          id: 10,
          jurados: [jurado(7, 'Luis Mora', 'activo'), jurado(8, 'Ana Ruiz', 'invitado')],
        }),
        proyecto({ id: 11, nombre: 'Portal de pagos', jurados: [jurado(9, 'Eva Paz', 'finalizado')] }),
        proyectoComoJurado('activo', { jurados: [jurado(5, 'Rosa Vega', 'activo')] }),
      ],
      COORDINADOR,
    )
    renderRoute('/jurados', { usuario: COORDINADOR, api: handler })

    const tabla = await screen.findByRole('table', { name: 'Jurados de tus proyectos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(4)
    const fila = within(tabla).getByRole('row', { name: /Ana Ruiz/ })
    expect(within(fila).getByText('ana@correo.com')).toBeInTheDocument()
    expect(within(fila).getByText('Invitado')).toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: 'Sistema de inventario' })).toHaveAttribute(
      'href',
      '/proyectos/10',
    )
    expect(within(tabla).queryByText('Rosa Vega')).not.toBeInTheDocument()
    for (const [nombre, valor] of [
      ['Jurados activos', '1'],
      ['Invitaciones pendientes', '1'],
      ['Finalizados', '1'],
    ] as const) {
      expect(within(screen.getByRole('group', { name: nombre })).getByText(valor)).toBeInTheDocument()
    }
  })

  it('tells when the coordinator has no judges yet', async () => {
    const { handler } = proyectosApi([proyecto()], COORDINADOR)
    renderRoute('/jurados', { usuario: COORDINADOR, api: handler })
    expect(await screen.findByText('Aún no hay jurados en tus proyectos')).toBeInTheDocument()
  })

  it('shows the server message when the projects cannot be loaded', async () => {
    const { handler } = proyectosApi([], COORDINADOR)
    renderRoute('/jurados', {
      usuario: COORDINADOR,
      api: conError(handler, (_m, path) => path === '/api/proyectos', 500, 'Error interno'),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno')
  })
})
