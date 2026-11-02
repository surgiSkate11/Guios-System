import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { COORDINADOR } from '../../test/fake-api'
import { consolidacionApi, consolidacionBase } from '../../test/consolidacion-api'
import { combinar } from '../../test/evaluacion-api'
import { conError, proyecto, proyectoComoJurado, proyectosApi } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

function montar(inicial = consolidacionBase()) {
  const consolidacion = consolidacionApi(10, inicial)
  const proyectos = proyectosApi([proyecto({ id: 10, estado: 'en_curso' })], COORDINADOR)
  const api = combinar(consolidacion.handler, proyectos.handler)
  return { consolidacion, ...renderRoute('/proyectos/10/consolidacion', { usuario: COORDINADOR, api }) }
}

describe('Consolidación y alcance: project picker', () => {
  it('lists only the projects I coordinate', async () => {
    const proyectos = proyectosApi(
      [proyecto({ id: 10, nombre: 'Sistema de inventario' }), proyectoComoJurado('activo', { id: 20 })],
      COORDINADOR,
    )
    renderRoute('/evaluaciones/consolidacion', { usuario: COORDINADOR, api: proyectos.handler })

    expect(await screen.findByRole('link', { name: /Sistema de inventario/ })).toHaveAttribute(
      'href',
      '/proyectos/10/consolidacion',
    )
    expect(screen.queryByText('Portal académico')).not.toBeInTheDocument()
  })
})

describe('Consolidación y alcance (HU-03, HU-04)', () => {
  it('shows every judge importance, the consolidated value, IR, relevance and scope', async () => {
    montar()
    const tabla = await screen.findByRole('table', { name: 'Consolidación de importancias' })
    expect(within(tabla).getByRole('columnheader', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(within(tabla).getByRole('columnheader', { name: 'Luis Mora' })).toBeInTheDocument()

    const compatibilidad = within(tabla).getByRole('row', { name: /Compatibilidad/ })
    expect(within(compatibilidad).getAllByRole('cell').map((celda) => celda.textContent).slice(0, 6)).toEqual([
      'Tecnológica',
      '3',
      '4',
      '3',
      '3',
      '3',
    ])
    expect(within(compatibilidad).getByText('Sí')).toBeInTheDocument()
    expect(within(tabla).getByRole('row', { name: /Prueba/ })).toHaveTextContent('No')
    const documentacion = within(tabla).getByRole('row', { name: /Documentación/ })
    expect(documentacion).toHaveTextContent('Falta 1')
    expect(within(documentacion).getByLabelText('Alcance de Documentación')).toHaveValue('externo')
    expect(screen.getByRole('radio', { name: 'Mediana' })).toBeChecked()
  })

  it('changes the consolidation method and reloads the preview', async () => {
    const user = userEvent.setup()
    const { requests } = montar()
    await screen.findByRole('table', { name: 'Consolidación de importancias' })

    await user.click(screen.getByRole('radio', { name: 'Promedio' }))

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Promedio' })).toBeChecked())
    expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({
      path: '/api/proyectos/10',
      body: { metodoConsolidacion: 'promedio' },
    })
    expect(requests.filter((r) => r.path === '/api/proyectos/10/consolidacion')).toHaveLength(2)
  })

  it('shows the server message when the method can no longer change', async () => {
    const user = userEvent.setup()
    const consolidacion = consolidacionApi(10)
    const proyectos = proyectosApi([proyecto({ id: 10, estado: 'en_curso' })], COORDINADOR)
    const api = conError(
      combinar(consolidacion.handler, proyectos.handler),
      (method, path) => method === 'PATCH' && path === '/api/proyectos/10',
      409,
      'La consolidación ya fue confirmada',
    )
    renderRoute('/proyectos/10/consolidacion', { usuario: COORDINADOR, api })
    await screen.findByRole('table', { name: 'Consolidación de importancias' })

    await user.click(screen.getByRole('radio', { name: 'Promedio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La consolidación ya fue confirmada')
    expect(screen.getByRole('radio', { name: 'Mediana' })).toBeChecked()
  })

  it('saves the default scope without justification', async () => {
    const user = userEvent.setup()
    const inicial = consolidacionBase()
    inicial.factores[0]!.alcanceEfectivo = 'externo'
    inicial.factores[0]!.justificacionAlcance = 'Depende del proveedor'
    const { requests } = montar(inicial)
    const fila = await screen.findByRole('row', { name: /Compatibilidad/ })

    await user.selectOptions(within(fila).getByLabelText('Alcance de Compatibilidad'), 'interno')
    await user.click(within(fila).getByRole('button', { name: 'Guardar alcance de Compatibilidad' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Alcance de Compatibilidad guardado')
    expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({
      path: '/api/proyectos/10/factores/501/alcance',
      body: { alcance: 'interno' },
    })
  })

  it('requires a justification to reclassify the scope and sends it', async () => {
    const user = userEvent.setup()
    const { requests, consolidacion } = montar()
    const fila = await screen.findByRole('row', { name: /Compatibilidad/ })

    await user.selectOptions(within(fila).getByLabelText('Alcance de Compatibilidad'), 'externo')
    await user.click(within(fila).getByRole('button', { name: 'Guardar alcance de Compatibilidad' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Justificación requerida')
    expect(requests.some((r) => r.method === 'PATCH')).toBe(false)

    await user.type(within(fila).getByLabelText('Justificación de Compatibilidad'), 'Depende del proveedor')
    await user.click(within(fila).getByRole('button', { name: 'Guardar alcance de Compatibilidad' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Alcance de Compatibilidad guardado')
    expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({
      body: { alcance: 'externo', justificacion: 'Depende del proveedor' },
    })
    expect(consolidacion.estado.factores[0]!.alcanceEfectivo).toBe('externo')
  })

  it('shows the server message when consolidation cannot be confirmed', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByRole('table', { name: 'Consolidación de importancias' })

    await user.click(screen.getByRole('button', { name: 'Confirmar consolidación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Faltan 1 importancias por registrar')
  })

  it('confirms the consolidation and locks the method', async () => {
    const user = userEvent.setup()
    const inicial = consolidacionBase()
    inicial.factores = inicial.factores.slice(0, 2)
    const { requests } = montar(inicial)
    await screen.findByRole('table', { name: 'Consolidación de importancias' })

    await user.click(screen.getByRole('button', { name: 'Confirmar consolidación' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Consolidación confirmada')
    expect(requests.some((r) => r.method === 'POST' && r.path === '/api/proyectos/10/consolidacion/confirmar')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Confirmar consolidación' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Promedio' })).toBeDisabled()
  })

  it('shows the load error of the server', async () => {
    const proyectos = proyectosApi([proyecto({ id: 10 })], COORDINADOR)
    const api = conError(
      proyectos.handler,
      (method, path) => method === 'GET' && path === '/api/proyectos/10/consolidacion',
      404,
      'Proyecto no encontrado',
    )
    renderRoute('/proyectos/10/consolidacion', { usuario: COORDINADOR, api })
    expect(await screen.findByRole('alert')).toHaveTextContent('Proyecto no encontrado')
  })
})
