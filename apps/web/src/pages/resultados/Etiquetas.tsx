import type { Foda, Nivel } from '../../api/resultados'
import { ESTILO_FODA, ESTILO_NIVEL, ETIQUETA_FODA } from './formato'

const base = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium'

export function FodaEtiqueta({ foda }: { foda: Foda | null }) {
  if (!foda) return <span className="text-slate-400">—</span>
  return <span className={`${base} ${ESTILO_FODA[foda]}`}>{ETIQUETA_FODA[foda]}</span>
}

export function NivelEtiqueta({ nivel, largo = false }: { nivel: Nivel; largo?: boolean }) {
  return (
    <span className={`${base} ${ESTILO_NIVEL[nivel]}`}>
      {largo ? `Nivel de adopción ${nivel}` : `Nivel ${nivel}`}
    </span>
  )
}

/** Tabs to pick one software of the project. */
export function PestanasSoftware({
  softwares,
  activo,
  onCambio,
}: {
  softwares: { id: number; nombre: string }[]
  activo: number
  onCambio: (id: number) => void
}) {
  return (
    <div role="tablist" aria-label="Software" className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
      {softwares.map((software) => (
        <button
          key={software.id}
          type="button"
          role="tab"
          aria-selected={software.id === activo}
          onClick={() => onCambio(software.id)}
          className={`rounded-md px-4 py-1.5 text-sm ${
            software.id === activo ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          {software.nombre}
        </button>
      ))}
    </div>
  )
}
