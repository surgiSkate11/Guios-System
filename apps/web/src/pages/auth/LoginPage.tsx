import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth-context'
import { AuthCard } from './AuthCard'
import { errorMessage, inputClass, labelClass, submitClass } from './form'
import { FormError, PasswordField } from './PasswordField'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError(null)
    setSending(true)
    try {
      await login(String(data.get('email')), String(data.get('password')))
      navigate('/inicio', { replace: true })
    } catch (failure) {
      setError(errorMessage(failure))
      setSending(false)
    }
  }

  return (
    <AuthCard>
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
        <PasswordField autoComplete="current-password" />
        <div className="text-right">
          <Link to="/recuperar" className="text-xs text-blue-600 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <button type="submit" disabled={sending} className={submitClass}>
          Iniciar sesión
        </button>
        <p className="text-center text-xs text-slate-500">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="text-blue-600 hover:underline">
            Registrate
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
