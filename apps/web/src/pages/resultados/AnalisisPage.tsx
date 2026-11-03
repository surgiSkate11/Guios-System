import { Bot, Check, Flag } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import { generarAnalisis, obtenerAnalisis, type Analisis as AnalisisIA } from '../../api/analisis'
import { obtenerProyecto } from '../../api/proyectos'
import { obtenerResultados } from '../../api/resultados'
import { useAccion, useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { SelectorProyecto } from '../../components/SelectorProyecto'
import { AvisoMensaje, botonClass, EstadoCarga } from '../../components/ui'
import { BANDERAS, formatearMomento } from './formato'

function Analisis({ id }: { id: number }) {
  const cargarProyecto = useCallback(() => obtenerProyecto(id), [id])
  const proyecto = useCarga(cargarProyecto)
  const cargar = useCallback(() => obtenerAnalisis(id), [id])
  const { datos, cargando, error, status } = useCarga(cargar)
  const cargarResultados = useCallback(() => obtenerResultados(id), [id])
  const resultados = useCarga(cargarResultados)
  const { aviso, ocupado, ejecutar } = useAccion()
  // A new generation replaces the loaded analysis.
  const [generado, setAnalisis] = useState<AnalisisIA | null>(null)
  const analisis = generado ?? datos

  const generar = () =>
    ejecutar(async () => {
      setAnalisis(await generarAnalisis(id))
      return 'Análisis generado'
    })

  const sinAnalisis = !analisis && status === 404
  const etiquetaDe = (tipo: string) => BANDERAS.find((bandera) => bandera.tipo === tipo)?.etiqueta ?? tipo

  return (
    <div>
      <PageHeader
        title="Análisis asistido por IA"
        subtitle={proyecto.datos ? proyecto.datos.nombre : 'Redacción basada en resultados ya calculados'}
        icon={Bot}
        actions={
          (analisis || sinAnalisis) && (
            <button type="button" className={botonClass} disabled={ocupado} onClick={() => void generar()}>
              {analisis ? 'Regenerar análisis' : 'Generar análisis'}
            </button>
          )
        }
      />
      <AvisoMensaje aviso={aviso?.tipo === 'error' ? aviso : null} />
      <div className="grid grid-cols-[1fr_20rem] gap-5">
        <section className="rounded-2xl bg-white p-6">
          {analisis ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-800">
                <Check aria-hidden className="size-3" />
                Números verificados · la IA no calcula ni decide
              </span>
              {analisis.respaldo && (
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Texto de respaldo: el servicio de IA no estaba disponible
                </p>
              )}
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                {analisis.texto
                  .split(/\n\s*\n/)
                  .filter((parrafo) => parrafo.trim() !== '')
                  .map((parrafo, indice) => (
                    <p key={indice} className="whitespace-pre-line">
                      {parrafo.trim()}
                    </p>
                  ))}
              </div>
              <p className="mt-6 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Modelo: {analisis.modelo} · Generado el {formatearMomento(analisis.creadoEn)}
              </p>
            </>
          ) : sinAnalisis ? (
            <p className="text-sm text-slate-500">Aún no hay análisis</p>
          ) : (
            <EstadoCarga cargando={cargando} error={error} />
          )}
        </section>
        <section aria-labelledby="banderas-detectadas" className="rounded-2xl bg-white p-5">
          <h2 id="banderas-detectadas" className="mb-3 font-semibold text-slate-900">
            Banderas detectadas
          </h2>
          {resultados.datos ? (
            resultados.datos.banderas.length === 0 ? (
              <p className="text-sm text-slate-500">No se detectaron banderas.</p>
            ) : (
              <ul className="space-y-3">
                {resultados.datos.banderas.map((bandera, indice) => (
                  <li key={indice} className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-slate-700">
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-orange-700">
                      <Flag aria-hidden className="size-3" />
                      {etiquetaDe(bandera.tipo)}
                    </span>
                    {bandera.mensaje}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-sm text-slate-500">Sin resultados generados.</p>
          )}
        </section>
      </div>
    </div>
  )
}

/** AI analysis of a project (RF-16, HU-09); only its coordinator opens it. */
export function AnalisisPage() {
  const { id } = useParams()
  return <Analisis key={id} id={Number(id)} />
}

/** Menu entry: the projects I coordinate. */
export function AnalisisSelectorPage() {
  return (
    <SelectorProyecto
      title="Análisis con IA"
      subtitle="Elegí el proyecto a analizar"
      icon={Bot}
      filtro={(proyecto) => proyecto.miRol === 'coordinador'}
      pantalla="analisis"
      vacio="No coordinás ningún proyecto."
    />
  )
}
