import { ChevronRight, ClipboardList } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { EstadoCarga } from '../../components/ui'
import { useProyectos } from '../../proyectos/proyectos-context'
import { EstadoProyectoEtiqueta } from '../proyectos/Etiquetas'

/** Entry of "Calificar factores": the projects where the user is an active judge. */
export function CalificarPage() {
  const { proyectos, cargando, error } = useProyectos()
  const activos = (proyectos ?? []).filter((proyecto) => proyecto.miEstadoJurado === 'activo')

  return (
    <div>
      <PageHeader
        title="Calificar factores"
        subtitle="Elegí el proyecto que vas a evaluar como jurado"
        icon={ClipboardList}
      />
      {!proyectos ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : activos.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">No tenés proyectos activos como jurado.</p>
      ) : (
        <ul className="space-y-3">
          {activos.map((proyecto) => (
            <li key={proyecto.id}>
              <Link
                to={`/proyectos/${proyecto.id}/importancia`}
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
