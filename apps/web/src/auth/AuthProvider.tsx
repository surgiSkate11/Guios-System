import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { AuthContext, type AuthState } from './auth-context'
import {
  borrarToken,
  guardarToken,
  iniciarSesion,
  leerToken,
  registrarse,
  usuarioActual,
  type SesionRespuesta,
  type Usuario,
} from './session'

type Estado = { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; usuario: Usuario }

/** Holds the signed-in user; on start it restores the session from the stored token. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() =>
    leerToken() ? { status: 'loading' } : { status: 'anonymous' },
  )

  useEffect(() => {
    const token = leerToken()
    if (!token) return
    let activo = true
    usuarioActual(token)
      .then((usuario) => {
        if (activo) setEstado({ status: 'authenticated', usuario })
      })
      .catch((error: unknown) => {
        // Only a rejected token is dropped; a network failure keeps it for the next start.
        if (error instanceof ApiError && error.status === 401) borrarToken()
        if (activo) setEstado({ status: 'anonymous' })
      })
    return () => {
      activo = false
    }
  }, [])

  const abrirSesion = useCallback((sesion: SesionRespuesta) => {
    guardarToken(sesion.accessToken)
    setEstado({ status: 'authenticated', usuario: sesion.usuario })
  }, [])

  const login = useCallback(
    async (email: string, password: string) => abrirSesion(await iniciarSesion(email, password)),
    [abrirSesion],
  )

  const registro = useCallback(
    async (nombre: string, email: string, password: string) =>
      abrirSesion(await registrarse(nombre, email, password)),
    [abrirSesion],
  )

  const logout = useCallback(() => {
    borrarToken()
    setEstado({ status: 'anonymous' })
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      status: estado.status,
      usuario: estado.status === 'authenticated' ? estado.usuario : null,
      login,
      registro,
      logout,
    }),
    [estado, login, registro, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
