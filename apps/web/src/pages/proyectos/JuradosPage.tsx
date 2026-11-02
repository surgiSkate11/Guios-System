import { Users } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { useProyectos } from '../../proyectos/proyectos-context'
import { Contador, EstadoJuradoEtiqueta } from './Etiquetas'

/** Judges of the projects the user coordinates (RF-03, HU-19); they are managed in each project. */
export function JuradosPage() {
  const { proyectos, error, cargando } = useProyectos()
  const filas = (proyectos ?? [])
    .filter((proyecto) => proyecto.miRol === 'coordinador')
    .flatMap((proyecto) => proyecto.jurados.map((jurado) => ({ proyecto, jurado })))
  const contar = (estado: string) => filas.filter(({ jurado }) => jurado.estado === estado).length

  return (
    <>
      <PageHeader
        title="Jurados"
        subtitle="Jurados de tus proyectos y el estado de su solicitud"
        icon={Users}
      />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {cargando && <p className="text-sm text-slate-500">Cargando…</p>}
      {proyectos && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <Contador etiqueta="Jurados activos" valor={contar('activo')} />
            <Contador etiqueta="Invitaciones pendientes" valor={contar('invitado')} />
            <Contador etiqueta="Finalizados" valor={contar('finalizado')} />
          </div>
          <section className="rounded-2xl bg-white p-6">
            {filas.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay jurados en tus proyectos</p>
            ) : (
              <table aria-label="Jurados de tus proyectos" className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Correo</th>
                    <th className="px-3 py-2">Proyecto</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ proyecto, jurado }) => (
                    <tr key={`${proyecto.id}-${jurado.idUsuario}`} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{jurado.nombre}</td>
                      <td className="px-3 py-3 text-slate-600">{jurado.email}</td>
                      <td className="px-3 py-3">
                        <Link to={`/proyectos/${proyecto.id}`} className="text-brand-700 hover:underline">
                          {proyecto.nombre}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <EstadoJuradoEtiqueta estado={jurado.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-4 text-sm text-slate-500">
              Para agregar o quitar jurados abre el proyecto correspondiente.
            </p>
          </section>
        </>
      )}
    </>
  )
}
