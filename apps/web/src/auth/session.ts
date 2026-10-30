import { apiFetch } from '../api/client'

/** Global role of a user (spec section 2). The juror role is per project. */
export type Rol = 'invitado' | 'coordinador' | 'administrador'

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
  idOrganizacion: number | null
}

export interface SesionRespuesta {
  accessToken: string
  usuario: Usuario
}

/** localStorage key of the access token. */
export const TOKEN_KEY = 'guios.token'

export function leerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function guardarToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function borrarToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function iniciarSesion(email: string, password: string): Promise<SesionRespuesta> {
  return apiFetch<SesionRespuesta>('/auth/login', { method: 'POST', body: { email, password } })
}

export function registrarse(
  nombre: string,
  email: string,
  password: string,
): Promise<SesionRespuesta> {
  return apiFetch<SesionRespuesta>('/auth/registro', {
    method: 'POST',
    body: { nombre, email, password },
  })
}

export function usuarioActual(token: string): Promise<Usuario> {
  return apiFetch<Usuario>('/auth/me', { token })
}
