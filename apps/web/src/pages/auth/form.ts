import { ApiError } from '../../api/client'

export const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-brand-600'

export const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-800'

export const submitClass =
  'w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

/** Message to show for a failed sign-in or sign-up request. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo completar la solicitud'
}
