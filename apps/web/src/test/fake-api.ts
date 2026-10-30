import { vi } from 'vitest'
import type { Usuario } from '../auth/session'

export const COORDINADOR: Usuario = {
  id: 2,
  nombre: 'Edna Lee',
  email: 'edna@organizacion.com',
  rol: 'coordinador',
  idOrganizacion: 1,
}

export const ADMINISTRADOR: Usuario = {
  id: 1,
  nombre: 'Admin Guios',
  email: 'admin@guios.local',
  rol: 'administrador',
  idOrganizacion: null,
}

export const INVITADO: Usuario = {
  id: 3,
  nombre: 'Ana Pérez',
  email: 'ana@correo.com',
  rol: 'invitado',
  idOrganizacion: null,
}

export interface FakeRequest {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

export interface FakeResponse {
  status: number
  body?: unknown
}

export type FakeHandler = (request: FakeRequest) => FakeResponse | undefined

/**
 * Replaces global fetch with an in-memory API. Each request goes to the handler;
 * requests it does not answer get a 404. Recorded requests are returned for assertions.
 */
export function installFakeApi(handler: FakeHandler) {
  const requests: FakeRequest[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost')
    const request: FakeRequest = {
      method: (init.method ?? 'GET').toUpperCase(),
      path: url.pathname,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    requests.push(request)
    const response = handler(request) ?? { status: 404, body: { message: 'Not Found' } }
    return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { requests, fetchMock }
}

export const TEST_TOKEN = 'test-token'

/** Fake API where GET /api/auth/me answers with the given user for TEST_TOKEN. */
export function sessionHandler(usuario: Usuario): FakeHandler {
  return ({ method, path, headers }) => {
    if (method === 'GET' && path === '/api/auth/me') {
      return headers.authorization === `Bearer ${TEST_TOKEN}`
        ? { status: 200, body: usuario }
        : { status: 401, body: { message: 'Unauthorized' } }
    }
    return undefined
  }
}
