import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Organizacion, Parametros, UsuarioAdmin } from '../../api/admin'
import { ADMINISTRADOR, TEST_TOKEN, type FakeHandler } from '../../test/fake-api'
import { renderRoute } from '../../test/render-route'

function parametros(): Parametros {
  return {
    umbralFoda: 3,
    umbralDesacuerdo: 10,
    umbralEmpateTecnico: 2,
    umbralMetricaAlta: 80,
    umbralFactorDiscutido: 2,
    umbralDatosInciertos: 25,
    metodoConsolidacion: 'mediana',
  }
}

function organizaciones(): Organizacion[] {
  return [
    { id: 1, nombre: 'Alcaldía Norte', sector: 'publico', activo: true },
    { id: 2, nombre: 'Consultora Sur', sector: 'privado', activo: true },
    { id: 3, nombre: 'Org Antigua', sector: 'independiente', activo: false },
  ]
}

function usuarios(): UsuarioAdmin[] {
  return [
    {
      id: 1,
      nombre: 'Admin Guios',
      email: 'admin@guios.local',
      rol: 'administrador',
      activo: true,
      idOrganizacion: null,
      organizacion: null,
    },
    {
      id: 2,
      nombre: 'Edna Lee',
      email: 'edna@organizacion.com',
      rol: 'coordinador',
      activo: true,
      idOrganizacion: 1,
      organizacion: { id: 1, nombre: 'Alcaldía Norte' },
    },
    {
      id: 3,
      nombre: 'Ana Pérez',
      email: 'ana@correo.com',
      rol: 'invitado',
      activo: true,
      idOrganizacion: null,
      organizacion: null,
    },
  ]
}

/** In-memory fake of the A1 endpoints; `fail` makes every write answer with that error. */
function adminApi(fail?: { status: number; message: string }) {
  let params = parametros()
  const orgs = organizaciones()
  const users = usuarios()
  const handler: FakeHandler = ({ method, path, body, headers }) => {
    if (headers.authorization !== `Bearer ${TEST_TOKEN}`) {
      return { status: 401, body: { message: 'Unauthorized' } }
    }
    if (method === 'GET') {
      if (path === '/api/parametros') return { status: 200, body: params }
      if (path === '/api/organizaciones') return { status: 200, body: orgs }
      if (path === '/api/usuarios') return { status: 200, body: users }
      return undefined
    }
    if (fail) return { status: fail.status, body: { statusCode: fail.status, message: fail.message } }
    if (path === '/api/parametros' && method === 'PUT') {
      params = body as Parametros
      return { status: 200, body: params }
    }
    if (path === '/api/organizaciones' && method === 'POST') {
      const creada = { id: 10, activo: true, ...(body as object) } as Organizacion
      orgs.push(creada)
      return { status: 201, body: creada }
    }
    const org = path.match(/^\/api\/organizaciones\/(\d+)$/)
    if (org && method === 'PATCH') {
      const actual = orgs.find((item) => item.id === Number(org[1]))!
      Object.assign(actual, body)
      return { status: 200, body: actual }
    }
    const user = path.match(/^\/api\/usuarios\/(\d+)$/)
    if (user && method === 'PATCH') {
      const actual = users.find((item) => item.id === Number(user[1]))!
      Object.assign(actual, body)
      const organizacion = orgs.find((item) => item.id === actual.idOrganizacion)
      actual.organizacion = organizacion ? { id: organizacion.id, nombre: organizacion.nombre } : null
      return { status: 200, body: actual }
    }
    return undefined
  }
  return handler
}

function renderConfiguracion(fail?: { status: number; message: string }) {
  return renderRoute('/admin/configuracion', { usuario: ADMINISTRADOR, api: adminApi(fail) })
}

async function openTab(name: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('tab', { name }))
  return user
}

describe('Configuración · estructura', () => {
  it('shows the three tabs, Parámetros de análisis first', async () => {
    renderConfiguracion()
    expect(await screen.findByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Parámetros de análisis', 'Usuarios y roles', 'Organizaciones'])
    expect(screen.getByRole('tab', { name: 'Parámetros de análisis' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByText('Módulo en construcción')).not.toBeInTheDocument()
  })
})

describe('Configuración · Parámetros de análisis', () => {
  it('loads the parameters with the session token', async () => {
    const { requests } = renderConfiguracion()
    expect(await screen.findByLabelText('Desviación entre jurados')).toHaveValue(10)
    expect(screen.getByLabelText('Umbral FODA')).toHaveValue(3)
    expect(screen.getByLabelText('Empate técnico')).toHaveValue(2)
    expect(screen.getByLabelText('Métrica alta')).toHaveValue(80)
    expect(screen.getByLabelText('Factor discutido')).toHaveValue(2)
    expect(screen.getByLabelText('Datos inciertos')).toHaveValue(25)
    expect(screen.getByRole('radio', { name: 'Mediana' })).toBeChecked()
    const get = requests.find((r) => r.method === 'GET' && r.path === '/api/parametros')
    expect(get?.headers.authorization).toBe(`Bearer ${TEST_TOKEN}`)
  })

  it('saves the full parameter set and confirms it', async () => {
    const user = userEvent.setup()
    const { requests } = renderConfiguracion()
    const desviacion = await screen.findByLabelText('Desviación entre jurados')
    await user.clear(desviacion)
    await user.type(desviacion, '15')
    await user.click(screen.getByRole('radio', { name: 'Promedio' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Parámetros guardados')
    const put = requests.find((r) => r.method === 'PUT' && r.path === '/api/parametros')
    expect(put?.body).toEqual({
      ...parametros(),
      umbralDesacuerdo: 15,
      metodoConsolidacion: 'promedio',
    })
  })

  it.each([
    ['Umbral FODA', '5'],
    ['Umbral FODA', '0'],
    ['Factor discutido', '4'],
    ['Datos inciertos', '101'],
    ['Métrica alta', '-1'],
  ])('rejects %s = %s locally without calling the API', async (label, value) => {
    const user = userEvent.setup()
    const { requests } = renderConfiguracion()
    const field = await screen.findByLabelText(label)
    await user.clear(field)
    await user.type(field, value)
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(label)
    expect(requests.some((r) => r.method === 'PUT')).toBe(false)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('rejects an empty value without calling the API', async () => {
    const user = userEvent.setup()
    const { requests } = renderConfiguracion()
    await user.clear(await screen.findByLabelText('Empate técnico'))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Empate técnico')
    expect(requests.some((r) => r.method === 'PUT')).toBe(false)
  })

  it('shows the server message when saving fails', async () => {
    const user = userEvent.setup()
    renderConfiguracion({ status: 400, message: 'umbralFoda debe estar entre 1 y 4' })
    await screen.findByLabelText('Umbral FODA')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('umbralFoda debe estar entre 1 y 4')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Configuración · Usuarios y roles', () => {
  it('lists the users with role, organization and state', async () => {
    renderConfiguracion()
    await openTab('Usuarios y roles')

    const row = (await screen.findByText('edna@organizacion.com')).closest('tr')!
    expect(within(row).getByText('Edna Lee')).toBeInTheDocument()
    expect(within(row).getByLabelText('Rol de Edna Lee')).toHaveValue('coordinador')
    expect(within(row).getByLabelText('Organización de Edna Lee')).toHaveValue('1')
    expect(within(row).getByLabelText('Activo: Edna Lee')).toBeChecked()
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + 3 users
  })

  it('offers only active organizations to assign', async () => {
    renderConfiguracion()
    await openTab('Usuarios y roles')
    const select = await screen.findByLabelText('Organización de Ana Pérez')
    const labels = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(labels).toEqual(['Sin organización', 'Alcaldía Norte', 'Consultora Sur'])
  })

  it('changes the role and organization of a user in one request', async () => {
    const { requests } = renderConfiguracion()
    const user = await openTab('Usuarios y roles')
    const row = (await screen.findByText('ana@correo.com')).closest('tr')!
    const guardar = within(row).getByRole('button', { name: 'Guardar Ana Pérez' })
    expect(guardar).toBeDisabled()

    await user.selectOptions(within(row).getByLabelText('Organización de Ana Pérez'), '2')
    await user.selectOptions(within(row).getByLabelText('Rol de Ana Pérez'), 'coordinador')
    await user.click(guardar)

    expect(await screen.findByRole('status')).toHaveTextContent('Usuario actualizado')
    const patch = requests.find((r) => r.method === 'PATCH' && r.path === '/api/usuarios/3')
    expect(patch?.body).toEqual({ rol: 'coordinador', idOrganizacion: 2 })
    await waitFor(() =>
      expect(within(row).getByRole('button', { name: 'Guardar Ana Pérez' })).toBeDisabled(),
    )
  })

  it('deactivates a user sending only the changed field', async () => {
    const { requests } = renderConfiguracion()
    const user = await openTab('Usuarios y roles')
    const row = (await screen.findByText('ana@correo.com')).closest('tr')!
    await user.click(within(row).getByLabelText('Activo: Ana Pérez'))
    await user.click(within(row).getByRole('button', { name: 'Guardar Ana Pérez' }))

    await screen.findByRole('status')
    const patch = requests.find((r) => r.method === 'PATCH' && r.path === '/api/usuarios/3')
    expect(patch?.body).toEqual({ activo: false })
  })

  it('can clear the organization of a user (null)', async () => {
    const { requests } = renderConfiguracion()
    const user = await openTab('Usuarios y roles')
    const row = (await screen.findByText('edna@organizacion.com')).closest('tr')!
    await user.selectOptions(within(row).getByLabelText('Organización de Edna Lee'), '')
    await user.click(within(row).getByRole('button', { name: 'Guardar Edna Lee' }))
    await screen.findByRole('status')
    const patch = requests.find((r) => r.method === 'PATCH' && r.path === '/api/usuarios/2')
    expect(patch?.body).toEqual({ idOrganizacion: null })
  })

  it('does not let the administrator change their own role or state', async () => {
    renderConfiguracion()
    await openTab('Usuarios y roles')
    const row = (await screen.findByText('admin@guios.local')).closest('tr')!
    expect(within(row).getByLabelText('Rol de Admin Guios')).toBeDisabled()
    expect(within(row).getByLabelText('Activo: Admin Guios')).toBeDisabled()
  })

  it('shows the server message and keeps the row editable when the rule fails', async () => {
    renderConfiguracion({ status: 409, message: 'Un coordinador necesita una organización' })
    const user = await openTab('Usuarios y roles')
    const row = (await screen.findByText('ana@correo.com')).closest('tr')!
    await user.selectOptions(within(row).getByLabelText('Rol de Ana Pérez'), 'coordinador')
    await user.click(within(row).getByRole('button', { name: 'Guardar Ana Pérez' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Un coordinador necesita una organización',
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(within(row).getByLabelText('Rol de Ana Pérez')).toHaveValue('coordinador')
    expect(within(row).getByRole('button', { name: 'Guardar Ana Pérez' })).toBeEnabled()
  })
})

describe('Configuración · Organizaciones', () => {
  it('lists the organizations with sector and state', async () => {
    renderConfiguracion()
    await openTab('Organizaciones')
    const row = (await screen.findByLabelText('Nombre de Alcaldía Norte')).closest('tr')!
    expect(within(row).getByLabelText('Sector de Alcaldía Norte')).toHaveValue('publico')
    expect(within(row).getByLabelText('Activa: Alcaldía Norte')).toBeChecked()
    expect(screen.getByLabelText('Activa: Org Antigua')).not.toBeChecked()
  })

  it('creates an organization and shows it in the list', async () => {
    const { requests } = renderConfiguracion()
    const user = await openTab('Organizaciones')
    await user.type(await screen.findByLabelText('Nombre de la nueva organización'), 'Fundación Este')
    await user.selectOptions(screen.getByLabelText('Sector de la nueva organización'), 'independiente')
    await user.click(screen.getByRole('button', { name: 'Crear organización' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Organización creada')
    const post = requests.find((r) => r.method === 'POST' && r.path === '/api/organizaciones')
    expect(post?.body).toEqual({ nombre: 'Fundación Este', sector: 'independiente' })
    expect(await screen.findByLabelText('Nombre de Fundación Este')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la nueva organización')).toHaveValue('')
  })

  it('does not create an organization without name or sector', async () => {
    const { requests } = renderConfiguracion()
    const user = await openTab('Organizaciones')
    await screen.findByLabelText('Nombre de la nueva organización')
    await user.click(screen.getByRole('button', { name: 'Crear organización' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST')).toBe(false)
  })

  it('shows the server message when creating fails', async () => {
    renderConfiguracion({ status: 409, message: 'Ya existe una organización con ese nombre' })
    const user = await openTab('Organizaciones')
    await user.type(await screen.findByLabelText('Nombre de la nueva organización'), 'Alcaldía Norte')
    await user.selectOptions(screen.getByLabelText('Sector de la nueva organización'), 'publico')
    await user.click(screen.getByRole('button', { name: 'Crear organización' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe una organización con ese nombre',
    )
  })

  it('renames, changes sector and deactivates an organization', async () => {
    const { requests } = renderConfiguracion()
    const user = await openTab('Organizaciones')
    const name = await screen.findByLabelText('Nombre de Consultora Sur')
    const row = name.closest('tr')!
    const guardar = within(row).getByRole('button', { name: 'Guardar Consultora Sur' })
    expect(guardar).toBeDisabled()

    await user.clear(name)
    await user.type(name, 'Consultora Austral')
    await user.selectOptions(within(row).getByLabelText('Sector de Consultora Sur'), 'publico')
    await user.click(within(row).getByLabelText('Activa: Consultora Sur'))
    await user.click(guardar)

    expect(await screen.findByRole('status')).toHaveTextContent('Organización actualizada')
    const patch = requests.find((r) => r.method === 'PATCH' && r.path === '/api/organizaciones/2')
    expect(patch?.body).toEqual({ nombre: 'Consultora Austral', sector: 'publico', activo: false })
  })

  it('shows the server message when an update fails', async () => {
    renderConfiguracion({ status: 409, message: 'La organización tiene usuarios activos' })
    const user = await openTab('Organizaciones')
    const row = (await screen.findByLabelText('Nombre de Alcaldía Norte')).closest('tr')!
    await user.click(within(row).getByLabelText('Activa: Alcaldía Norte'))
    await user.click(within(row).getByRole('button', { name: 'Guardar Alcaldía Norte' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La organización tiene usuarios activos')
  })
})
