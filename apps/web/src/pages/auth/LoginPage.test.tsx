import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TOKEN_KEY } from '../../auth/session'
import { COORDINADOR, TEST_TOKEN, type FakeHandler } from '../../test/fake-api'
import { renderRoute } from '../../test/render-route'

const loginApi: FakeHandler = ({ method, path, body, headers }) => {
  if (method === 'POST' && path === '/api/auth/login') {
    const { email, password } = body as { email: string; password: string }
    return email === COORDINADOR.email && password === 'secreta123'
      ? { status: 200, body: { accessToken: TEST_TOKEN, usuario: COORDINADOR } }
      : { status: 401, body: { message: 'Credenciales inválidas' } }
  }
  if (method === 'GET' && path === '/api/auth/me' && headers.authorization === `Bearer ${TEST_TOKEN}`) {
    return { status: 200, body: COORDINADOR }
  }
  return undefined
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Correo'), email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

describe('LoginPage', () => {
  it('renders the login form of the prototype without the app layout', async () => {
    renderRoute('/login')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'GUIOS PRO' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute(
      'href',
      '/recuperar',
    )
    expect(
      screen.queryByRole('navigation', { name: 'Navegación principal' }),
    ).not.toBeInTheDocument()
  })

  it('toggles password visibility with Mostrar / Ocultar', async () => {
    const user = userEvent.setup()
    renderRoute('/login')
    const password = await screen.findByLabelText('Contraseña')

    await user.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('signs in, stores the token and goes to /inicio with the real name', async () => {
    const { router, requests } = renderRoute('/login', { api: loginApi })
    await screen.findByLabelText('Correo')
    await fillAndSubmit(COORDINADOR.email, 'secreta123')

    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
    expect(localStorage.getItem(TOKEN_KEY)).toBe(TEST_TOKEN)
    expect(requests.find((r) => r.path === '/api/auth/login')).toMatchObject({
      method: 'POST',
      body: { email: COORDINADOR.email, password: 'secreta123' },
    })
    expect(await screen.findByRole('button', { name: /Edna Lee/ })).toBeInTheDocument()
  })

  it('shows the server message on wrong credentials and stays on /login', async () => {
    const { router } = renderRoute('/login', { api: loginApi })
    await screen.findByLabelText('Correo')
    await fillAndSubmit(COORDINADOR.email, 'incorrecta')

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas')
    expect(router.state.location.pathname).toBe('/login')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('sends a signed-in user to /inicio', async () => {
    const { router } = renderRoute('/login', { usuario: COORDINADOR })
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
  })
})
