import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth-context'
import { AuthCard } from './AuthCard'
import { errorMessage, inputClass, labelClass, submitClass } from './form'
import { FormError, PasswordField } from './PasswordField'

/** Self sign-up: the account always starts with the guest role (RF-01, HU-18). */
export function RegistroPage() {
  const { registro } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError(null)
    setSending(true)
    try {
      await registro(
        String(data.get('nombre')).trim(),
        String(data.get('email')),
        String(data.get('password')),
      )
      navigate('/inicio', { replace: true })
    } catch (failure) {
      setError(errorMessage(failure))
      setSending(false)
    }
  }

  return (
    <AuthCard>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-center text-base font-semibold text-slate-800">Crear cuenta</h2>
        <FormError message={error} />
        <div>
          <label htmlFor="nombre" className={labelClass}>
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            required
            className={inputClass}
          />
        </div>
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
        <PasswordField autoComplete="new-password" />
        <button type="submit" disabled={sending} className={submitClass}>
          Crear cuenta
        </button>
        <p className="text-center text-xs text-slate-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
