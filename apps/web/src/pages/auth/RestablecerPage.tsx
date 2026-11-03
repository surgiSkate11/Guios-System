import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { restablecerContrasena } from '../../auth/session'
import { AuthCard } from './AuthCard'
import { errorMessage, labelClass, submitClass, inputClass } from './form'
import { FormError } from './PasswordField'

const ENLACE_INVALIDO = 'El enlace no es válido o venció'
const MINIMO = 8

/** New password from the e-mailed link `/restablecer?token=...` (A7). */
export function RestablecerPage() {
  const token = useSearchParams()[0].get('token')
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(token ? null : ENLACE_INVALIDO)
  const [sending, setSending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password'))
    if (password.length < MINIMO) {
      setError(`La contraseña debe tener al menos ${MINIMO} caracteres`)
      return
    }
    setError(null)
    setSending(true)
    try {
      await restablecerContrasena(token!, password)
      navigate('/login', { replace: true, state: { aviso: 'Contraseña actualizada. Iniciá sesión.' } })
    } catch (failure) {
      setError(errorMessage(failure))
      setSending(false)
    }
  }

  return (
    <AuthCard>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">Nueva contraseña</h2>
      <FormError message={error} />
      {token && (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="password" className={labelClass}>
              Nueva contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={sending} className={submitClass}>
            Guardar contraseña
          </button>
        </form>
      )}
      <Link to="/recuperar" className="mt-6 block text-center text-sm font-medium text-blue-600 hover:underline">
        Pedir un enlace nuevo
      </Link>
    </AuthCard>
  )
}
