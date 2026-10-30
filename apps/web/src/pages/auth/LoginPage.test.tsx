import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '../../test/render-route'

describe('LoginPage', () => {
  it('renders the login form of the prototype without the app layout', () => {
    renderRoute('/login')
    expect(screen.getByRole('heading', { level: 1, name: 'GUIOS PRO' })).toBeInTheDocument()
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
    const password = screen.getByLabelText('Contraseña')

    await user.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})
