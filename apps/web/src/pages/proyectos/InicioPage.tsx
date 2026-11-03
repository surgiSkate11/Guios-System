import { House, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { aceptarSolicitud, rechazarSolicitud, type ProyectoResumen } from '../../api/proyectos'
import { useAuth } from '../../auth/auth-context'
import { useAccion } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { AvisoMensaje, botonClass } from '../../components/ui'
import { useProyectos } from '../../proyectos/proyectos-context'
import { Contador, EstadoProyectoEtiqueta } from './Etiquetas'
import { formatearFecha } from './formato'

const RECIENTES = 5

const tarjetaClass = 'rounded-2xl bg-white p-6'

function NuevoProyectoEnlace() {
  return (
    <Link to="/proyectos/nuevo" className={`${botonClass} inline-flex items-center gap-1`}>
      <Plus aria-hidden className="size-4" />
      Nuevo proyecto
    </Link>
  )
}

function InicioAdministrador() {
  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Administración de GUIOS PRO"
        icon={House}
      />
      <section className={tarjetaClass}>
        <p className="mb-4 text-slate-600">
          El administrador no crea ni ve proyectos. Gestiona la plataforma desde estas pantallas:
        </p>
        <ul className="space-y-2 text-sm font-medium text-brand-700">
          <li>
            <Link to="/admin/configuracion" className="hover:underline">
              Configuración
            </Link>
          </li>
          <li>
            <Link to="/admin/catalogo" className="hover:underline">
              Catálogo de factores
            </Link>
          </li>
        </ul>
      </section>
    </>
  )
}

function Solicitudes() {
  const { solicitudes, errorSolicitudes, registrar, quitar } = useProyectos()
  const { aviso, ocupado, ejecutar } = useAccion()

  const aceptar = (proyecto: ProyectoResumen) =>
    ejecutar(async () => {
      registrar(await aceptarSolicitud(proyecto.id))
      return `Aceptaste la solicitud de ${proyecto.nombre}`
    })

  const rechazar = (proyecto: ProyectoResumen) =>
    ejecutar(async () => {
      await rechazarSolicitud(proyecto.id)
      quitar(proyecto.id)
      return `Rechazaste la solicitud de ${proyecto.nombre}`
    })

  return (
    <aside className={tarjetaClass}>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Pendientes</h2>
      <AvisoMensaje aviso={aviso} />
      {errorSolicitudes && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorSolicitudes}
        </p>
      )}
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Solicitudes de jurado</h3>
      {solicitudes && solicitudes.length === 0 && (
        <p className="text-sm text-slate-500">No tienes solicitudes pendientes</p>
      )}
      <ul className="space-y-3">
        {(solicitudes ?? []).map((proyecto) => (
          <li
            key={proyecto.id}
            aria-label={`Solicitud de ${proyecto.nombre}`}
            className="rounded-xl bg-amber-50 p-4"
          >
            <p className="font-semibold text-slate-900">{proyecto.nombre}</p>
            <p className="mb-3 text-sm text-slate-600">Coordina: {proyecto.coordinador.nombre}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={botonClass}
                disabled={ocupado}
                onClick={() => aceptar(proyecto)}
              >
                Aceptar
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                disabled={ocupado}
                onClick={() => rechazar(proyecto)}
              >
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function Recientes({ proyectos }: { proyectos: ProyectoResumen[] }) {
  const recientes = proyectos.slice(0, RECIENTES)
  return (
    <section className={tarjetaClass}>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Proyectos recientes</h2>
      {recientes.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no tienes proyectos</p>
      ) : (
        <>
          <table aria-label="Proyectos recientes" className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2">Proyecto</th>
                <th className="px-3 py-2">Organización</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Jurados</th>
                <th className="px-3 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((proyecto) => (
                <tr key={proyecto.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium">
                    <Link to={`/proyectos/${proyecto.id}`} className="text-slate-900 hover:underline">
                      {proyecto.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{proyecto.organizacion.nombre}</td>
                  <td className="px-3 py-3">
                    <EstadoProyectoEtiqueta estado={proyecto.estado} />
                  </td>
                  <td className="px-3 py-3 text-slate-600">{proyecto.jurados.length}</td>
                  <td className="px-3 py-3 text-slate-600">{formatearFecha(proyecto.fechaInicio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-500">
            Mostrando {recientes.length} de {proyectos.length}
          </p>
        </>
      )}
    </section>
  )
}

/** Home panel (HU-18): counters and recent projects of the user, plus their judge requests. */
export function InicioPage() {
  const { usuario } = useAuth()
  const { proyectos, error, cargando } = useProyectos()

  if (usuario?.rol === 'administrador') return <InicioAdministrador />

  const coordinados = (proyectos ?? []).filter((proyecto) => proyecto.miRol === 'coordinador')
  const juradosActivos = coordinados.reduce(
    (total, proyecto) => total + proyecto.jurados.filter((jurado) => jurado.estado === 'activo').length,
    0,
  )

  return (
    <>
      <PageHeader
        title="Inicio"
        subtitle="Resumen de tus proyectos de evaluación"
        icon={House}
        actions={usuario?.rol === 'coordinador' ? <NuevoProyectoEnlace /> : undefined}
      />
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {cargando && <p className="text-sm text-slate-500">Cargando…</p>}
      {proyectos && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          <Contador
            etiqueta="Proyectos en curso"
            valor={proyectos.filter((proyecto) => proyecto.estado === 'en_curso').length}
          />
          <Contador
            etiqueta="Evaluaciones cerradas"
            valor={proyectos.filter((proyecto) => proyecto.estado === 'cerrado').length}
          />
          <Contador etiqueta="Jurados activos" valor={juradosActivos} />
          <Contador
            etiqueta="Softwares candidatos"
            valor={proyectos.reduce((total, proyecto) => total + proyecto.softwares.length, 0)}
          />
        </div>
      )}
      <div className="grid grid-cols-[2fr_1fr] items-start gap-6">
        {proyectos ? <Recientes proyectos={proyectos} /> : <div />}
        <Solicitudes />
      </div>
    </>
  )
}
