import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { TOKEN_KEY, type Usuario } from '../auth/session'
import { routes } from '../router'
import { installFakeApi, sessionHandler, TEST_TOKEN, type FakeHandler } from './fake-api'

export interface RenderRouteOptions {
  /** Signed-in user: stores a token and answers GET /api/auth/me with this user. */
  usuario?: Usuario
  /** Extra API handler, tried before the session handler. */
  api?: FakeHandler
}

/** Renders the real application routes starting at the given path, against a fake API. */
export function renderRoute(path: string, options: RenderRouteOptions = {}) {
  const { usuario, api } = options
  if (usuario) localStorage.setItem(TOKEN_KEY, TEST_TOKEN)
  const session = usuario ? sessionHandler(usuario) : undefined
  const fakeApi = installFakeApi((request) => api?.(request) ?? session?.(request))
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(<RouterProvider router={router} />)
  return { ...result, router, ...fakeApi }
}
