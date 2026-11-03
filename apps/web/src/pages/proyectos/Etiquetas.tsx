import type { EstadoJurado, EstadoProyecto } from '../../api/proyectos'
import { ETIQUETA_ESTADO, ETIQUETA_ESTADO_JURADO } from './formato'

const base = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium'

const ESTILO_ESTADO: Record<EstadoProyecto, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  en_curso: 'bg-amber-100 text-amber-800',
  cerrado: 'bg-green-100 text-green-800',
}

const ESTILO_JURADO: Record<EstadoJurado, string> = {
  invitado: 'bg-amber-100 text-amber-800',
  activo: 'bg-green-100 text-green-800',
  finalizado: 'bg-slate-100 text-slate-600',
}

export function EstadoProyectoEtiqueta({ estado }: { estado: EstadoProyecto }) {
  return <span className={`${base} ${ESTILO_ESTADO[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>
}

export function EstadoJuradoEtiqueta({ estado }: { estado: EstadoJurado }) {
  return <span className={`${base} ${ESTILO_JURADO[estado]}`}>{ETIQUETA_ESTADO_JURADO[estado]}</span>
}

/** Summary counter card of the home and judges pages; the group name is the counter label. */
export function Contador({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div role="group" aria-label={etiqueta} className="rounded-2xl bg-white px-6 py-5">
      <p className="text-3xl font-bold text-slate-900">{valor}</p>
      <p className="text-sm text-slate-500">{etiqueta}</p>
    </div>
  )
}
