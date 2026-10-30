import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth-context'
import { AuthProvider } from './AuthProvider'
import { puedeAcceder } from './permissions'

/** Root of the route tree: every page shares one session. */
export function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

function Cargando() {
  return (
    <div role="status" className="grid min-h-full place-items-center text-sm text-slate-500">
      Cargando…
    </div>
  )
}

/**
 * Authenticated area: without a session it goes to /login; a path the role cannot open
 * goes to /inicio (HU-18), even when typed in the address bar.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, usuario } = useAuth()
  const { pathname } = useLocation()
  if (status === 'loading') return <Cargando />
  if (!usuario) return <Navigate to="/login" replace />
  if (!puedeAcceder(usuario.rol, pathname)) return <Navigate to="/inicio" replace />
  return children
}

/** Sign-in and sign-up pages: a signed-in user goes straight to /inicio. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <Cargando />
  if (status === 'authenticated') return <Navigate to="/inicio" replace />
  return children
}
