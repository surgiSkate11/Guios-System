import { describe, expect, it } from 'vitest'
import { installFakeApi } from '../test/fake-api'
import { ApiError, apiFetch } from './client'

describe('apiFetch', () => {
  it('sends JSON with the bearer token and returns the parsed body', async () => {
    const { requests } = installFakeApi(() => ({ status: 200, body: { ok: true } }))
    await expect(
      apiFetch('/auth/login', { method: 'POST', body: { a: 1 }, token: 'abc' }),
    ).resolves.toEqual({ ok: true })
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/api/auth/login',
      body: { a: 1 },
      headers: { authorization: 'Bearer abc', 'content-type': 'application/json' },
    })
  })

  it('throws an ApiError with the status and the server message', async () => {
    installFakeApi(() => ({ status: 401, body: { message: 'Credenciales inválidas' } }))
    await expect(apiFetch('/auth/me')).rejects.toEqual(
      new ApiError(401, 'Credenciales inválidas'),
    )
  })

  it('joins the validation messages of a 400', async () => {
    installFakeApi(() => ({
      status: 400,
      body: { message: ['email must be an email', 'password is too short'] },
    }))
    await expect(apiFetch('/auth/registro', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      message: 'email must be an email. password is too short',
    })
  })

  it('uses a generic message when the server sends none', async () => {
    installFakeApi(() => ({ status: 500 }))
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({
      status: 500,
      message: 'No se pudo completar la solicitud',
    })
  })
})
