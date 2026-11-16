import { importanciaLiteratura } from '@guios/calculo'
import { Activity } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  medirAnclas,
  obtenerAnclas,
  type AnclaMedida,
  type MedicionAnclas,
} from '../../api/catalogo'
import { avisoDeError, useCarga } from '../../components/carga'
import { AvisoMensaje, botonClass, EstadoCarga, type Aviso } from '../../components/ui'
import { ETIQUETA_IMPORTANCIA } from '../evaluacion/escalas'

/** Polling period while the server measures the anchors. */
const SONDEO_MS = 2000

const thClass = 'px-4 py-3 font-medium'
const secundarioClass =
  'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function FilaAncla({
  ancla,
  cortes,
}: {
  ancla: AnclaMedida
  cortes: MedicionAnclas['cortes']
}) {
  // The IL of an anchor is read with the cuts published with the same version (RN-02).
  const il = cortes ? importanciaLiteratura(ancla.r, cortes) : null
  return (
    <tr className="border-t border-slate-100 text-slate-700">
      <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-900">
        {ancla.nombre}
      </th>
      <td className="px-4 py-2.5">{ancla.citas}</td>
      <td className="px-4 py-2.5">{ancla.ns}</td>
      <td className="px-4 py-2.5">{ancla.r.toFixed(2)}</td>
      <td className="px-4 py-2.5">
        {il === null ? '—' : `${il} · ${ETIQUETA_IMPORTANCIA[il]}`}
      </td>
    </tr>
  )
}

function Dispersion({ datos }: { datos: NonNullable<MedicionAnclas['dispersion']> }) {
  const valores: [string, string][] = [
    ['Mínimo', datos.minimo.toFixed(2)],
    ['Mediana', datos.mediana.toFixed(2)],
    ['Promedio', datos.promedio.toFixed(2)],
    ['Máximo', datos.maximo.toFixed(2)],
    ['Desviación', datos.desviacion.toFixed(2)],
  ]
  return (
    <dl aria-label="Dispersión de las anclas" className="mt-4 grid grid-cols-5 gap-3 text-sm">
      {valores.map(([nombre, valor]) => (
        <div key={nombre} className="rounded-xl bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">{nombre}</dt>
          <dd className="text-lg font-bold text-slate-900">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Anchor measurement (spec section 6, A11). Shows the anchors published with the current
 * version and starts an incremental measurement: only the active factors that still have no
 * anchor are measured, so the existing ones keep their TC, NS and r. Progress is polled.
 */
export function AnclasCatalogo({
  idsFactoresActivos,
  onCambio,
}: {
  /** Active factors of the current catalog version, to know which ones still lack an anchor. */
  idsFactoresActivos: readonly number[]
  /** Called when a measurement finishes, so the catalog and the versions reload. */
  onCambio: () => void
}) {
  const [refresco, setRefresco] = useState(0)
  // State returned by the last poll while measuring; `datos` takes over once it ends.
  const [enVivo, setEnVivo] = useState<MedicionAnclas | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)
  // A failed poll schedules another one: a transient error must not freeze the progress.
  const [reintentos, setReintentos] = useState(0)

  const cargar = useCallback(() => {
    void refresco
    return obtenerAnclas()
  }, [refresco])
  const { datos, cargando, error } = useCarga(cargar)

  const medicion = enVivo ?? datos
  const midiendo = medicion?.estado === 'en_curso'
  const conAncla = new Set((medicion?.anclas ?? []).map((ancla) => ancla.idFactor))
  const faltantes = idsFactoresActivos.filter((id) => !conAncla.has(id)).length

  useEffect(() => {
    if (!midiendo || !medicion) return
    let activo = true
    const temporizador = setTimeout(() => {
      obtenerAnclas().then(
        (siguiente) => {
          if (!activo) return
          if (siguiente.estado === 'en_curso') return setEnVivo(siguiente)
          setEnVivo(null)
          setRefresco((valor) => valor + 1)
          setAviso(
            siguiente.estado === 'fallida'
              ? { tipo: 'error', texto: siguiente.error ?? 'La medición de anclas falló' }
              : {
                  tipo: 'ok',
                  texto: `Anclas medidas: el catálogo publicó la versión ${siguiente.version?.numero ?? ''}`.trim(),
                },
          )
          onCambio()
        },
        (failure: unknown) => {
          if (!activo) return
          setAviso(avisoDeError(failure))
          setReintentos((n) => n + 1)
        },
      )
    }, SONDEO_MS)
    return () => {
      activo = false
      clearTimeout(temporizador)
    }
  }, [midiendo, medicion, reintentos, onCambio])

  async function medir() {
    setConfirmando(false)
    setOcupado(true)
    setAviso(null)
    try {
      setEnVivo(await medirAnclas())
    } catch (failure) {
      setAviso(avisoDeError(failure))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section aria-labelledby="anclas" className="mb-5 rounded-2xl bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="anclas" className="font-semibold text-slate-900">
            Anclas de la versión vigente
          </h2>
          <p className="text-xs text-slate-500">
            TC = citas totales · NS = subfactores medidos · r = TC / NS · la IL se lee con los cortes
            publicados en la misma versión
          </p>
        </div>
        {midiendo ? (
          <p role="status" aria-live="polite" className="text-sm text-slate-600">
            {`Midiendo ${medicion?.progreso?.hechos ?? 0} de ${medicion?.progreso?.total ?? 0} factores`}
            {medicion?.factorActual ? ` · ${medicion.factorActual}` : '…'}
          </p>
        ) : (
          <button
            type="button"
            className={`${botonClass} inline-flex items-center gap-1`}
            onClick={() => setConfirmando(true)}
            disabled={ocupado || faltantes === 0}
            title={
              faltantes === 0 ? 'Todos los factores activos ya tienen ancla' : undefined
            }
          >
            <Activity aria-hidden className="size-4" />
            Medir anclas
          </button>
        )}
      </div>
      <AvisoMensaje aviso={aviso} />
      {confirmando && (
        <div
          role="group"
          aria-label="Confirmar medición de anclas"
          className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p>
            {`${faltantes === 1 ? 'Se medirá 1 factor' : `Se medirán ${faltantes} factores`} con la IA y se publicará una versión nueva del catálogo con los cortes recalculados. Las anclas existentes conservan sus citas, su NS y su r.`}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={botonClass} onClick={() => void medir()}>
              Sí, medir anclas
            </button>
            <button type="button" className={secundarioClass} onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {!medicion ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : (
        <>
          {medicion.estado === 'fallida' && medicion.error && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {medicion.error}
            </p>
          )}
          {medicion.cortes && (
            <p className="mb-3 text-xs text-slate-500">
              {`Cortes: rq1 ${medicion.cortes.rq1.toFixed(2)} · rq2 ${medicion.cortes.rq2.toFixed(2)} · rq3 ${medicion.cortes.rq3.toFixed(2)}`}
            </p>
          )}
          {medicion.anclas.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no hay anclas medidas en esta versión.</p>
          ) : (
            <div className="overflow-x-auto">
            <table aria-label="Anclas de la versión vigente" className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className={thClass}>Factor</th>
                  <th className={thClass}>TC</th>
                  <th className={thClass}>NS</th>
                  <th className={thClass}>r</th>
                  <th className={thClass}>IL</th>
                </tr>
              </thead>
              <tbody>
                {medicion.anclas.map((ancla) => (
                  <FilaAncla key={ancla.idFactor} ancla={ancla} cortes={medicion.cortes} />
                ))}
              </tbody>
            </table>
            </div>
          )}
          <p className="mt-3 text-sm text-slate-600">
            {faltantes === 0
              ? 'Todos los factores activos tienen ancla en esta versión.'
              : `Quedan ${faltantes} ${faltantes === 1 ? 'factor activo' : 'factores activos'} sin ancla.`}
          </p>
          {medicion.dispersion && <Dispersion datos={medicion.dispersion} />}
        </>
      )}
    </section>
  )
}
