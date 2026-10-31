
export const campoClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-600 disabled:bg-slate-50 disabled:text-slate-400'

export const botonClass =
  'rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

/** Feedback of the last action of a tab: success is announced as status, failure as alert. */
export type Aviso = { tipo: 'ok' | 'error'; texto: string } | null

export function AvisoMensaje({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null
  const ok = aviso.tipo === 'ok'
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={`mb-4 rounded-lg px-3 py-2 text-sm ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
    >
      {aviso.texto}
    </p>
  )
}

/** Placeholder text while a tab loads, or the load error. */
export function EstadoCarga({ cargando, error }: { cargando: boolean; error: string | null }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    )
  }
  return cargando ? <p className="text-sm text-slate-500">Cargando…</p> : null
}
