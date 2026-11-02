import { useCallback, type ReactNode } from 'react'
import { Link, NavLink, useParams } from 'react-router'
import { obtenerProyecto, type ProyectoResumen } from '../../api/proyectos'
import { useAuth } from '../../auth/auth-context'
import { useCarga } from '../../components/carga'
import { EstadoCarga } from '../../components/ui'
import { EstadoProyectoEtiqueta } from '../proyectos/Etiquetas'

const PASOS = [
  { ruta: 'importancia', etiqueta: 'Paso 1 y 2. Obtención de factores relevantes' },
  { ruta: 'subfactores', etiqueta: 'Paso 3 y 4. Obtención de factores ponderados' },
  { ruta: 'resultado', etiqueta: 'Paso 5 y 6. Evaluación y recomendación sobre la adopción' },
]

/**
 * Shared frame of the judge steps (prototype "Calificar factores"): breadcrumb, project
 * header, step tabs and the step content, which receives the loaded project.
 */
export function PasosEvaluacion({ children }: { children: (proyecto: ProyectoResumen) => ReactNode }) {
  const id = Number(useParams().id)
  const { usuario } = useAuth()
  const cargar = useCallback(() => obtenerProyecto(id), [id])
  const { datos: proyecto, cargando, error } = useCarga(cargar)

  if (!proyecto) return <EstadoCarga cargando={cargando} error={error} />

  return (
    <div>
      <p className="mb-2 text-sm text-slate-500">
        <Link to="/evaluaciones" className="hover:underline">
          Evaluaciones
        </Link>{' '}
        / Calificar factores
      </p>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">{proyecto.nombre}</h1>
        <EstadoProyectoEtiqueta estado={proyecto.estado} />
      </div>
      <p className="mt-1 text-slate-500">Evaluando como jurado: {usuario?.nombre}</p>
      <nav aria-label="Pasos de la evaluación" className="mt-6 mb-5 flex gap-8 border-b border-slate-200">
        {PASOS.map((paso) => (
          <NavLink
            key={paso.ruta}
            to={`/proyectos/${proyecto.id}/${paso.ruta}`}
            className={({ isActive }) =>
              `-mb-px border-b-2 pb-3 text-sm font-medium ${
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`
            }
          >
            {paso.etiqueta}
          </NavLink>
        ))}
      </nav>
      {proyecto.estado !== 'en_curso' && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El proyecto no está en curso: las respuestas son de solo lectura.
        </p>
      )}
      {children(proyecto)}
    </div>
  )
}
