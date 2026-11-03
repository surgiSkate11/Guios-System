/** Error returned by the API, with the HTTP status and the server message. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
}

const GENERIC_ERROR = 'No se pudo completar la solicitud'
const NETWORK_ERROR = 'No se pudo conectar con el servidor'

function messageOf(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message
  if (Array.isArray(message)) return message.join('. ')
  return typeof message === 'string' && message !== '' ? message : GENERIC_ERROR
}

/**
 * Calls the REST API under /api (Vite proxies it to the server in development).
 * Resolves with the JSON body or rejects with an ApiError.
 */
export async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const { method = 'GET', body, token } = request
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, NETWORK_ERROR)
  }

  const text = await response.text()
  let data: unknown = null
  if (text !== '') {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!response.ok) throw new ApiError(response.status, messageOf(data))
  return data as T
}

/** Downloads a binary response (e.g. a PDF) under /api with the session token. */
export async function apiBlob(path: string, token: string | null): Promise<Blob> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError(0, NETWORK_ERROR)
  }
  if (!response.ok) {
    let data: unknown = null
    try {
      data = JSON.parse(await response.text())
    } catch {
      data = null
    }
    throw new ApiError(response.status, messageOf(data))
  }
  return response.blob()
}
