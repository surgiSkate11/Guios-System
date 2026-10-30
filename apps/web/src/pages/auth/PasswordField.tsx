import { useState } from 'react'
import { inputClass, labelClass } from './form'

/** Password input with the Mostrar / Ocultar toggle of the prototype. */
export function PasswordField({ autoComplete }: { autoComplete: 'current-password' | 'new-password' }) {
  const [showPassword, setShowPassword] = useState(false)
  return (
    <div>
      <label htmlFor="password" className={labelClass}>
        Contraseña
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          className={`${inputClass} pr-20`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800"
        >
          {showPassword ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </div>
  )
}

/** Error returned by the server, announced to screen readers. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
      {message}
    </p>
  )
}
