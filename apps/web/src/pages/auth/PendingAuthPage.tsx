import { Link } from 'react-router'
import { AuthCard } from './AuthCard'

/** Temporary sign-up and password recovery screens until their modules are built. */
export function PendingAuthPage({ title, covers }: { title: string; covers: string }) {
  return (
    <AuthCard>
      <h2 className="text-center text-base font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-center text-sm text-slate-500">
        Pantalla en construcción. Cubrirá: {covers}.
      </p>
      <Link
        to="/login"
        className="mt-6 block text-center text-sm font-medium text-blue-600 hover:underline"
      >
        Volver a iniciar sesión
      </Link>
    </AuthCard>
  )
}
