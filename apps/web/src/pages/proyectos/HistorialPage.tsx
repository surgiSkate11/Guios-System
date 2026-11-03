import { History } from 'lucide-react'
import { Link } from 'react-router'
import { listarProyectosCerrados } from '../../api/proyectos'
import { useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { EstadoCarga } from '../../components/ui'
import { EstadoProyectoEtiqueta } from './Etiquetas'
import { formatearFecha } from './formato'

const thClass = 'px-4 py-3 font-medium'

/** Closed projects (RF-17, HU-11) with the catalog version they used and their result. */
export function HistorialPage() {
  const { datos, cargando, error } = useCarga(listarProyectosCerrados)

  return (
    <div>
      <PageHeader title="Historial" subtitle="Proyectos cerrados y su resultado" icon={History} />
      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : datos.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">Todavía no hay proyectos cerrados.</p>
      ) : (
        <section className="rounded-2xl bg-white p-5">
          <table aria-label="Proyectos cerrados" className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className={thClass}>Proyecto</th>
                <th className={thClass}>Organización</th>
                <th className={thClass}>Inicio</th>
                <th className={thClass}>Fin</th>
                <th className={thClass}>Versión de catálogo</th>
                <th className={thClass}>Estado</th>
                <th className={thClass}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((proyecto) => (
                <tr key={proyecto.id} className="border-t border-slate-100 text-slate-700">
                  <th scope="row" className="px-4 py-3 text-left font-normal text-slate-900">
                    {proyecto.nombre}
                  </th>
                  <td className="px-4 py-3">{proyecto.organizacion.nombre}</td>
                  <td className="px-4 py-3">{formatearFecha(proyecto.fechaInicio)}</td>
                  <td className="px-4 py-3">{proyecto.fechaFin ? formatearFecha(proyecto.fechaFin) : '—'}</td>
                  <td className="px-4 py-3">Versión {proyecto.versionCatalogo}</td>
                  <td className="px-4 py-3">
                    <EstadoProyectoEtiqueta estado={proyecto.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/proyectos/${proyecto.id}/resultado`}
                      aria-label={`Ver resultado de ${proyecto.nombre}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
