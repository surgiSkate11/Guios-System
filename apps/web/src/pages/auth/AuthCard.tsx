import type { ReactNode } from 'react'

/** Centered card on a soft gradient, shared by the login, sign-up and recovery screens. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-blue-50 via-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white px-8 py-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="grid size-11 place-items-center rounded-lg bg-brand-600 text-lg font-bold text-white"
          >
            G
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-900">GUIOS PRO</h1>
          <p className="text-xs text-slate-500">Evaluación de Software</p>
        </div>
        {children}
      </div>
    </div>
  )
}
