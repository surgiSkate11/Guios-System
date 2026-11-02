import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { ProyectoResumen } from '../api/proyectos'
import { EstadoProyectoEtiqueta } from '../pages/proyectos/Etiquetas'
import { useProyectos } from '../proyectos/proyectos-context'
import { PageHeader } from './PageHeader'
import { EstadoCarga } from './ui'

interface SelectorProyectoProps {
  title: string
  subtitle: string
  icon: LucideIcon
  /** Projects offered by the screen. */
  filtro: (proyecto: ProyectoResumen) => boolean
  /** Screen of the chosen project, e.g. "consolidacion" for /proyectos/:id/consolidacion. */
  pantalla: string
  vacio: string
}

/** Menu entry of a per-project screen: lists the user's projects that can open it. */
export function SelectorProyecto({ title, subtitle, icon, filtro, pantalla, vacio }: SelectorProyectoProps) {
  const { proyectos, cargando, error } = useProyectos()
  const visibles = (proyectos ?? []).filter(filtro)

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} icon={icon} />
      {!proyectos ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : visibles.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">{vacio}</p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((proyecto) => (
            <li key={proyecto.id}>
              <Link
                to={`/proyectos/${proyecto.id}/${pantalla}`}
                className="flex items-center justify-between rounded-2xl bg-white px-6 py-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <span>
                  <span className="block font-semibold text-slate-900">{proyecto.nombre}</span>
                  <span className="text-sm text-slate-500">
                    {proyecto.organizacion.nombre} · Coordina {proyecto.coordinador.nombre}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <EstadoProyectoEtiqueta estado={proyecto.estado} />
                  <ChevronRight aria-hidden className="size-4 text-slate-400" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
