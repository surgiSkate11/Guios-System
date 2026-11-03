import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ADMINISTRADOR } from '../../test/fake-api'
import { catalogoApi } from '../../test/catalogo-api'
import { conError } from '../../test/proyectos-api'
import { renderRoute } from '../../test/render-route'

function abrir(api = catalogoApi().handler) {
  return renderRoute('/admin/catalogo', { usuario: ADMINISTRADOR, api })
}

async function tablaAdmin() {
  return screen.findByRole('table', { name: 'Administrar factores' })
}

describe('Administrar factores del catálogo (RF-18)', () => {
  it('lists every factor, active and inactive, with its dimension and state', async () => {
    abrir()
    const tabla = await tablaAdmin()
    const compatibilidad = within(tabla).getByRole('row', { name: /^Compatibilidad/ })
    expect(compatibilidad).toHaveTextContent('Tecnológica')
    expect(compatibilidad).toHaveTextContent('Activo')
    const reusabilidad = within(tabla).getByRole('row', { name: /^Reusabilidad/ })
    expect(reusabilidad).toHaveTextContent('Inactivo')
    expect(within(reusabilidad).getByRole('button', { name: 'Reactivar Reusabilidad' })).toBeInTheDocument()
  })

  it('deactivates and reactivates a factor', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    const tabla = await tablaAdmin()

    await user.click(within(tabla).getByRole('button', { name: 'Desactivar Compatibilidad' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Compatibilidad desactivado')
    expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({
      path: '/api/catalogo/factores/1',
      body: { activo: false },
    })
    const fila = within(tabla).getByRole('row', { name: /^Compatibilidad/ })
    expect(fila).toHaveTextContent('Inactivo')

    await user.click(within(fila).getByRole('button', { name: 'Reactivar Compatibilidad' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Compatibilidad reactivado')
    expect(requests.filter((r) => r.method === 'PATCH').at(-1)).toMatchObject({ body: { activo: true } })
  })

  it('edits the name and default scope of a factor', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    const tabla = await tablaAdmin()

    await user.click(within(tabla).getByRole('button', { name: 'Editar Compatibilidad' }))
    const nombre = within(tabla).getByLabelText('Nombre de Compatibilidad')
    await user.clear(nombre)
    await user.type(nombre, 'Compatibilidad técnica')
    await user.selectOptions(within(tabla).getByLabelText('Alcance de Compatibilidad'), 'externo')
    await user.click(within(tabla).getByRole('button', { name: 'Guardar Compatibilidad' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Factor actualizado')
    expect(requests.find((r) => r.method === 'PATCH')).toMatchObject({
      path: '/api/catalogo/factores/1',
      body: { nombre: 'Compatibilidad técnica', alcanceDefault: 'externo' },
    })
    expect(within(tabla).getByRole('row', { name: /^Compatibilidad técnica/ })).toHaveTextContent('Externo')
  })

  it('does not save an empty factor name', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    const tabla = await tablaAdmin()
    await user.click(within(tabla).getByRole('button', { name: 'Editar Compatibilidad' }))
    await user.clear(within(tabla).getByLabelText('Nombre de Compatibilidad'))
    await user.click(within(tabla).getByRole('button', { name: 'Guardar Compatibilidad' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del factor')
    expect(requests.some((r) => r.method === 'PATCH')).toBe(false)
  })

  it('manages the subfactors: deactivate, reactivate, edit and add', async () => {
    const user = userEvent.setup()
    const { requests } = abrir()
    const tabla = await tablaAdmin()
    await user.click(within(tabla).getByRole('button', { name: 'Administrar subfactores de Compatibilidad' }))

    const lista = within(tabla).getByRole('list', { name: 'Subfactores de Compatibilidad' })
    await user.click(within(lista).getByRole('button', { name: 'Desactivar subfactor El software usa formatos estándar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Subfactor desactivado')
    expect(requests.filter((r) => r.method === 'PATCH').at(-1)).toMatchObject({
      path: '/api/catalogo/subfactores/11',
      body: { activo: false },
    })

    await user.click(within(lista).getByRole('button', { name: 'Reactivar subfactor El software exporta a formatos propietarios' }))
    expect(requests.filter((r) => r.method === 'PATCH').at(-1)).toMatchObject({
      path: '/api/catalogo/subfactores/12',
      body: { activo: true },
    })

    await user.click(within(lista).getByRole('button', { name: 'Editar subfactor El software usa formatos estándar' }))
    const texto = within(lista).getByLabelText('Texto del subfactor')
    await user.clear(texto)
    await user.type(texto, 'Usa formatos abiertos')
    await user.click(within(lista).getByRole('button', { name: 'Guardar subfactor' }))
    expect(await within(lista).findByText('Usa formatos abiertos')).toBeInTheDocument()
    expect(requests.filter((r) => r.method === 'PATCH').at(-1)).toMatchObject({
      path: '/api/catalogo/subfactores/11',
      body: { texto: 'Usa formatos abiertos' },
    })

    await user.type(within(tabla).getByLabelText('Nuevo subfactor de Compatibilidad'), 'Soporta UTF-8')
    await user.click(within(tabla).getByRole('button', { name: 'Agregar subfactor a Compatibilidad' }))
    expect(await within(lista).findByText('Soporta UTF-8')).toBeInTheDocument()
    expect(requests.find((r) => r.method === 'POST')).toMatchObject({
      path: '/api/catalogo/factores/1/subfactores',
      body: { texto: 'Soporta UTF-8' },
    })
  })

  it('shows the server message when a change fails', async () => {
    const user = userEvent.setup()
    abrir(
      conError(
        catalogoApi().handler,
        (method, path) => method === 'PATCH' && path === '/api/catalogo/factores/1',
        409,
        'El factor se usa en proyectos en curso',
      ),
    )
    const tabla = await tablaAdmin()
    await user.click(within(tabla).getByRole('button', { name: 'Desactivar Compatibilidad' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El factor se usa en proyectos en curso')
    expect(within(tabla).getByRole('row', { name: /^Compatibilidad/ })).toHaveTextContent('Activo')
  })
})
