import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TOKEN_KEY, type Usuario } from '../../auth/session'
import { TEST_TOKEN, type FakeHandler } from '../../test/fake-api'
import { renderRoute } from '../../test/render-route'

const NUEVO: Usuario = {
  id: 9,
  nombre: 'Luis Rea',
  email: 'luis@correo.com',
  rol: 'invitado',
  idOrganizacion: null,
}

const registroApi: FakeHandler = ({ method, path, body, headers }) => {
  if (method === 'POST' && path === '/api/auth/registro') {
    const { email } = body as { email: string }
    return email === 'existe@correo.com'
      ? { status: 409, body: { message: 'El correo ya está registrado' } }
      : { status: 201, body: { accessToken: TEST_TOKEN, usuario: NUEVO } }
  }
  if (method === 'GET' && path === '/api/auth/me' && headers.authorization === `Bearer ${TEST_TOKEN}`) {
    return { status: 200, body: NUEVO }
  }
  return undefined
}

async function fillAndSubmit(nombre: string, email: string, password: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Nombre'), nombre)
  await user.type(screen.getByLabelText('Correo'), email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('RegistroPage', () => {
  it('renders name, email and password fields with a link back to sign in', async () => {
    renderRoute('/registro')
    expect(await screen.findByLabelText('Nombre')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Correo')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('link', { name: 'Iniciá sesión' })).toHaveAttribute('href', '/login')
  })

  it('creates a guest account, stores the token and shows only the home panel (HU-18)', async () => {
    const { router, requests } = renderRoute('/registro', { api: registroApi })
    await fillAndSubmit('Luis Rea', 'luis@correo.com', 'secreta123')

    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
    expect(localStorage.getItem(TOKEN_KEY)).toBe(TEST_TOKEN)
    expect(requests.find((r) => r.path === '/api/auth/registro')).toMatchObject({
      method: 'POST',
      body: { nombre: 'Luis Rea', email: 'luis@correo.com', password: 'secreta123' },
    })
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Inicio'])
  })

  it('shows the server message when the email is already registered', async () => {
    const { router } = renderRoute('/registro', { api: registroApi })
    await fillAndSubmit('Otra', 'existe@correo.com', 'secreta123')

    expect(await screen.findByRole('alert')).toHaveTextContent('El correo ya está registrado')
    expect(router.state.location.pathname).toBe('/registro')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
