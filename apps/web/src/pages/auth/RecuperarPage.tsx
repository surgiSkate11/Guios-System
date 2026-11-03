import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import { pedirRecuperacion } from '../../auth/session'
import { AuthCard } from './AuthCard'
import { inputClass, labelClass, submitClass } from './form'
import { FormError } from './PasswordField'

const AVISO = 'Si el correo existe, te enviamos un enlace'

/** Password recovery (RF-25): the answer never reveals whether the e-mail exists. */
export function RecuperarPage() {
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email')).trim()
    setError(null)
    setSending(true)
    try {
      await pedirRecuperacion(email)
      setEnviado(true)
    } catch (failure) {
      // Only the rate limit is worth telling; any other failure gets the same neutral notice.
      if (failure instanceof ApiError && failure.status === 429) setError(failure.message)
      else setEnviado(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthCard>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">Recuperar contraseña</h2>
      {enviado ? (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {AVISO}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />
          <div>
            <label htmlFor="email" className={labelClass}>
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nombre@organizacion.com"
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={sending} className={submitClass}>
            Enviar enlace
          </button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm font-medium text-blue-600 hover:underline">
        Volver a iniciar sesión
      </Link>
    </AuthCard>
  )
}
