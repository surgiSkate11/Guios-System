import { createContext, use } from 'react'
import type { Usuario } from './session'

export interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated'
  usuario: Usuario | null
  login: (email: string, password: string) => Promise<void>
  registro: (nombre: string, email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

/** Current session; must be used under AuthProvider. */
export function useAuth(): AuthState {
  const auth = use(AuthContext)
  if (!auth) throw new Error('useAuth must be used within AuthProvider')
  return auth
}
