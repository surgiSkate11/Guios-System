import { ScanSearch } from 'lucide-react'
import { useCallback } from 'react'
import { useParams } from 'react-router'
import { obtenerProyecto } from '../../api/proyectos'
import { obtenerAuditoria } from '../../api/resultados'
import { useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { SelectorProyecto } from '../../components/SelectorProyecto'
import { EstadoCarga } from '../../components/ui'
import { EstadoJuradoEtiqueta } from '../proyectos/Etiquetas'
import { uno } from './formato'

const thClass = 'px-4 py-3 font-medium'

function Auditoria({ id }: { id: number }) {
  const cargarProyecto = useCallback(() => obtenerProyecto(id), [id])
  const proyecto = useCarga(cargarProyecto)
  const cargar = useCallback(() => obtenerAuditoria(id), [id])
  const { datos, cargando, error } = useCarga(cargar)

  const header = (
    <PageHeader
      title="Auditoría de jurados"
      subtitle={proyecto.datos ? proyecto.datos.nombre : 'Registro de respuestas por jurado'}
      icon={ScanSearch}
    />
  )
  // Score columns need the project's softwares, so both loads must finish.
  if (!datos || !proyecto.datos) {
    return (
      <div>
        {header}
        <EstadoCarga cargando={cargando || proyecto.cargando} error={error ?? proyecto.error} />
      </div>
    )
  }

  const softwares = proyecto.datos.softwares
  const factores = [
    ...new Map(
      datos.jurados.flatMap((jurado) => jurado.importancias).map((item) => [item.idProyectoFactor, item.factor]),
    ),
  ]

  return (
    <div>
      {header}
      <section className="mb-5 overflow-x-auto rounded-2xl bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Respuestas por jurado</h2>
        <table aria-label="Jurados del proyecto" className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className={thClass}>Jurado</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Importancias</th>
              <th className={thClass}>Calificaciones</th>
              <th className={thClass}>Desconozco</th>
              {softwares.map((software) => (
                <th key={software.id} className={thClass}>
                  {software.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.jurados.map((jurado) => {
              const registradas = jurado.importancias.filter((item) => item.impDecisor !== null).length
              const { total, desconozco, porcentajeDesconozco } = jurado.calificaciones
              return (
                <tr key={jurado.idUsuario} className="border-t border-slate-100 text-slate-700">
                  <th scope="row" className="px-4 py-3 text-left font-normal text-slate-900">
                    {jurado.nombre}
                  </th>
                  <td className="px-4 py-3">
                    <EstadoJuradoEtiqueta estado={jurado.estado} />
                  </td>
                  <td className="px-4 py-3">
                    {registradas} de {jurado.importancias.length}
                  </td>
                  <td className="px-4 py-3">{total}</td>
                  <td className="px-4 py-3">
                    {desconozco} ({porcentajeDesconozco.toFixed(1)} %)
                  </td>
                  {softwares.map((software) => {
                    const score = jurado.scores.find((item) => item.idSoftware === software.id)?.score ?? null
                    return (
                      <td key={software.id} className="px-4 py-3">
                        {uno(score)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-2xl bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Importancias por jurado</h2>
        <table aria-label="Importancias por jurado" className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className={thClass}>Factor</th>
              {datos.jurados.map((jurado) => (
                <th key={jurado.idUsuario} className={thClass}>
                  {jurado.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factores.map(([idProyectoFactor, nombre]) => (
              <tr key={idProyectoFactor} className="border-t border-slate-100 text-slate-700">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-900">
                  {nombre}
                </th>
                {datos.jurados.map((jurado) => (
                  <td key={jurado.idUsuario} className="px-4 py-2.5">
                    {jurado.importancias.find((item) => item.idProyectoFactor === idProyectoFactor)?.impDecisor ??
                      '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

/** Judge audit of a project (HU-13); only its coordinator opens it. */
export function AuditoriaPage() {
  const { id } = useParams()
  return <Auditoria key={id} id={Number(id)} />
}

/** Menu entry: the projects I coordinate. */
export function AuditoriaSelectorPage() {
  return (
    <SelectorProyecto
      title="Auditoría de jurados"
      subtitle="Elegí el proyecto a auditar"
      icon={ScanSearch}
      filtro={(proyecto) => proyecto.miRol === 'coordinador'}
      pantalla="auditoria"
      vacio="No coordinás ningún proyecto."
    />
  )
}
