import { ClipboardCheck, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { EstadoProyecto, ProyectoResumen } from '../../api/proyectos'
import { useAuth } from '../../auth/auth-context'
import { PageHeader } from '../../components/PageHeader'
import { botonClass } from '../../components/ui'
import { useProyectos } from '../../proyectos/proyectos-context'
import { EstadoProyectoEtiqueta } from './Etiquetas'
import { ETIQUETA_ESTADO, ETIQUETA_METODO } from './formato'

type Filtro = 'todos' | EstadoProyecto

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'borrador', etiqueta: ETIQUETA_ESTADO.borrador },
  { valor: 'en_curso', etiqueta: ETIQUETA_ESTADO.en_curso },
  { valor: 'cerrado', etiqueta: ETIQUETA_ESTADO.cerrado },
]

const SOFTWARES_VISIBLES = 2

function Softwares({ proyecto }: { proyecto: ProyectoResumen }) {
  const visibles = proyecto.softwares.slice(0, SOFTWARES_VISIBLES)
  const restantes = proyecto.softwares.length - visibles.length
  const chip = 'rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
  return (
    <div className="flex flex-wrap gap-1.5">
      {visibles.map((software) => (
        <span key={software.id} className={chip}>
          {software.nombre}
        </span>
      ))}
      {restantes > 0 && <span className={chip}>+{restantes}</span>}
    </div>
  )
}

function textoJurados(cantidad: number): string {
  if (cantidad === 0) return 'Sin jurados'
  return cantidad === 1 ? '1 jurado' : `${cantidad} jurados`
}

/** Projects visible to the user, filtered by state (RF-17). */
export function EvaluacionesPage() {
  const { usuario } = useAuth()
  const { proyectos, error, cargando } = useProyectos()
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const visibles = (proyectos ?? []).filter((proyecto) => filtro === 'todos' || proyecto.estado === filtro)

  return (
    <>
      <PageHeader
        title="Mis evaluaciones"
        subtitle="Proyectos de evaluación de software"
        icon={ClipboardCheck}
        actions={
          usuario?.rol === 'coordinador' ? (
            <Link to="/proyectos/nuevo" className={`${botonClass} inline-flex items-center gap-1`}>
              <Plus aria-hidden className="size-4" />
              Nuevo proyecto
            </Link>
          ) : undefined
        }
      />
      <div role="tablist" aria-label="Estado del proyecto" className="mb-4 flex gap-6 border-b border-slate-200">
        {FILTROS.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="tab"
            aria-selected={filtro === opcion.valor}
            onClick={() => setFiltro(opcion.valor)}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
              filtro === opcion.valor
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {cargando && <p className="text-sm text-slate-500">Cargando…</p>}
      {proyectos && proyectos.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">Aún no tienes proyectos</p>
      )}
      {proyectos && proyectos.length > 0 && (
        <section className="rounded-2xl bg-white p-6">
          {visibles.length === 0 ? (
            <p className="text-sm text-slate-500">No hay proyectos en este estado</p>
          ) : (
            <table aria-label="Mis evaluaciones" className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">Proyecto</th>
                  <th className="px-3 py-2">Organización</th>
                  <th className="px-3 py-2">Softwares candidatos</th>
                  <th className="px-3 py-2">Jurados</th>
                  <th className="px-3 py-2">Método</th>
                  <th className="px-3 py-2">Versión de catálogo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((proyecto) => (
                  <tr key={proyecto.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{proyecto.nombre}</td>
                    <td className="px-3 py-3 text-slate-600">{proyecto.organizacion.nombre}</td>
                    <td className="px-3 py-3">
                      <Softwares proyecto={proyecto} />
                    </td>
                    <td className="px-3 py-3 text-slate-600">{textoJurados(proyecto.jurados.length)}</td>
                    <td className="px-3 py-3 text-slate-600">{ETIQUETA_METODO[proyecto.metodoConsolidacion]}</td>
                    <td className="px-3 py-3 text-slate-600">Versión {proyecto.versionCatalogo}</td>
                    <td className="px-3 py-3">
                      <EstadoProyectoEtiqueta estado={proyecto.estado} />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to={`/proyectos/${proyecto.id}`}
                        aria-label={`Abrir ${proyecto.nombre}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-sm text-slate-500">
            Mostrando {visibles.length} de {proyectos.length}
          </p>
        </section>
      )}
    </>
  )
}
