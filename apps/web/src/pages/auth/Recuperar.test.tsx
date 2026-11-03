import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { FakeHandler } from '../../test/fake-api'
import { renderRoute } from '../../test/render-route'

const AVISO = 'Si el correo existe, te enviamos un enlace'

const recuperacionApi: FakeHandler = ({ method, path, body }) => {
  if (method === 'POST' && path === '/api/auth/recuperar') return { status: 204 }
  if (method === 'POST' && path === '/api/auth/restablecer') {
    const { token } = body as { token: string }
    return token === 'bueno'
      ? { status: 204 }
      : { status: 400, body: { statusCode: 400, message: 'El enlace no es válido o venció' } }
  }
  return undefined
}

describe('Recuperar contraseña (RF-25)', () => {
  it('always shows the same notice after sending the e-mail', async () => {
    const user = userEvent.setup()
    const { requests } = renderRoute('/recuperar', { api: recuperacionApi })

    await user.type(await screen.findByLabelText('Correo'), 'ana@correo.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('status')).toHaveTextContent(AVISO)
    expect(requests.find((r) => r.path === '/api/auth/recuperar')).toMatchObject({
      method: 'POST',
      body: { email: 'ana@correo.com' },
    })
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/login')
  })

  it('shows the same notice even when the request fails', async () => {
    const user = userEvent.setup()
    renderRoute('/recuperar', {
      api: ({ path }) =>
        path === '/api/auth/recuperar' ? { status: 500, body: { statusCode: 500, message: 'Error' } } : undefined,
    })
    await user.type(await screen.findByLabelText('Correo'), 'nadie@correo.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent(AVISO)
  })

  it('shows the rate-limit message of the server', async () => {
    const user = userEvent.setup()
    renderRoute('/recuperar', {
      api: ({ path }) =>
        path === '/api/auth/recuperar'
          ? { status: 429, body: { statusCode: 429, message: 'Demasiados intentos, probá más tarde' } }
          : undefined,
    })
    await user.type(await screen.findByLabelText('Correo'), 'ana@correo.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos, probá más tarde')
  })
})

describe('Restablecer contraseña', () => {
  it('sets the new password with the token of the link and goes back to sign in', async () => {
    const user = userEvent.setup()
    const { requests, router } = renderRoute('/restablecer?token=bueno', { api: recuperacionApi })

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'nueva12345')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(requests.find((r) => r.path === '/api/auth/restablecer')).toMatchObject({
      method: 'POST',
      body: { token: 'bueno', password: 'nueva12345' },
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada. Iniciá sesión.')
  })

  it('shows the server message when the link is invalid or expired', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/restablecer?token=viejo', { api: recuperacionApi })
    await user.type(await screen.findByLabelText('Nueva contraseña'), 'nueva12345')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o venció')
    expect(router.state.location.pathname).toBe('/restablecer')
  })

  it('requires 8 characters before calling the server', async () => {
    const user = userEvent.setup()
    const { requests } = renderRoute('/restablecer?token=bueno', { api: recuperacionApi })
    await user.type(await screen.findByLabelText('Nueva contraseña'), 'corta')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña debe tener al menos 8 caracteres')
    expect(requests.some((r) => r.path === '/api/auth/restablecer')).toBe(false)
  })

  it('explains a link without token', async () => {
    renderRoute('/restablecer', { api: recuperacionApi })
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido o venció')
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })
})

describe('Too many attempts (429)', () => {
  const limite: FakeHandler = ({ method, path }) =>
    method === 'POST' && (path === '/api/auth/login' || path === '/api/auth/registro')
      ? { status: 429, body: { statusCode: 429, message: 'Demasiados intentos, probá más tarde' } }
      : undefined

  it('shows the server message on sign in', async () => {
    const user = userEvent.setup()
    renderRoute('/login', { api: limite })
    await user.type(await screen.findByLabelText('Correo'), 'ana@correo.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos, probá más tarde')
  })

  it('shows the server message on sign up', async () => {
    const user = userEvent.setup()
    renderRoute('/registro', { api: limite })
    await user.type(await screen.findByLabelText('Nombre'), 'Ana')
    await user.type(screen.getByLabelText('Correo'), 'ana@correo.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos, probá más tarde')
  })
})
