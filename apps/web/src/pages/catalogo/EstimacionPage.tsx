import { ArrowLeft, Bot, ListChecks } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  aprobarEstimacion,
  estimarConIa,
  obtenerEstimacion,
  rechazarEstimacion,
  type Aprobacion,
  type Estimacion,
} from '../../api/catalogo'
import { avisoDeError, useCarga } from '../../components/carga'
import { AvisoMensaje, botonClass, campoClass, EstadoCarga, type Aviso } from '../../components/ui'
import { ETIQUETA_IMPORTANCIA, VALORES } from '../evaluacion/escalas'
import { ETIQUETA_ESTADO_ESTIMACION } from './formato'
import { IndicadoresIs } from './IndicadoresIs'
import { calcularIsEnVivo, leerCitas } from './is-en-vivo'

/** Polling period of an AI estimation in progress. */
const SONDEO_MS = 2000

const secundarioClass =
  'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function Detalle({ inicial }: { inicial: Estimacion }) {
  const navigate = useNavigate()
  const [estimacion, setEstimacion] = useState(inicial)
  const [citas, setCitas] = useState<Record<number, string>>({})
  const [isElegida, setIsElegida] = useState<number | null>(null)
  const [justificacion, setJustificacion] = useState('')
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)

  const enCurso = estimacion.estado === 'en_curso'
  const editable = estimacion.estado === 'propuesta'

  // An AI estimation is polled until the server turns it into a proposal (or it fails).
  useEffect(() => {
    if (!enCurso) return
    let activo = true
    const temporizador = setTimeout(() => {
      obtenerEstimacion(estimacion.id).then(
        (siguiente) => {
          if (activo) setEstimacion(siguiente)
        },
        (failure: unknown) => {
          if (activo) setAviso(avisoDeError(failure))
        },
      )
    }, SONDEO_MS)
    return () => {
      activo = false
      clearTimeout(temporizador)
    }
  }, [enCurso, estimacion])

  const valorDe = (sub: Estimacion['subfactores'][number]) => citas[sub.id] ?? String(sub.citas)
  const enVivo = calcularIsEnVivo(
    estimacion.subfactores.map((sub) => ({ citas: valorDe(sub), dois: sub.dois })),
    estimacion.cortes,
  )
  const isCalculada = enVivo.calculo?.is ?? null
  const isAprobar = isElegida ?? isCalculada

  async function ejecutar(accion: () => Promise<string>) {
    setOcupado(true)
    setAviso(null)
    try {
      setAviso({ tipo: 'ok', texto: await accion() })
    } catch (failure) {
      setAviso(avisoDeError(failure))
    } finally {
      setOcupado(false)
    }
  }

  function aprobar() {
    if (!enVivo.calculo) {
      return setAviso({ tipo: 'error', texto: 'Las citas deben ser enteros mayores o iguales a 0' })
    }
    const distinta = isAprobar !== isCalculada
    if (distinta && justificacion.trim() === '') {
      return setAviso({ tipo: 'error', texto: 'Justificá la IS distinta de la calculada' })
    }
    const corregidas = estimacion.subfactores
      .filter((sub) => leerCitas(valorDe(sub)) !== sub.citas)
      .map((sub) => ({ idSubfactor: sub.id, citas: leerCitas(valorDe(sub))! }))
    const body: Aprobacion = {}
    if (corregidas.length > 0) body.citas = corregidas
    if (distinta) {
      body.isAprobada = isAprobar!
      body.justificacion = justificacion.trim()
    }
    void ejecutar(async () => {
      const aprobada = await aprobarEstimacion(estimacion.id, body)
      setEstimacion(aprobada)
      setCitas({})
      return `Factor aprobado con IS ${aprobada.isAprobada}`
    })
  }

  function rechazar() {
    if (justificacion.trim() === '') {
      return setAviso({ tipo: 'error', texto: 'Escribí la justificación del rechazo' })
    }
    void ejecutar(async () => {
      setEstimacion(await rechazarEstimacion(estimacion.id, justificacion.trim()))
      setCitas({})
      return 'Estimación rechazada'
    })
  }

  function estimar() {
    void ejecutar(async () => {
      const nueva = await estimarConIa(estimacion.factor.id)
      navigate(`/admin/catalogo/estimaciones/${nueva.id}`)
      return 'Estimación con IA iniciada'
    })
  }

  return (
    <div>
      <Link
        to="/admin/catalogo"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Volver al catálogo
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <ListChecks aria-hidden className="size-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{estimacion.factor.nombre}</h1>
            <p className="mt-0.5 text-slate-500">
              <span>{`${ETIQUETA_ESTADO_ESTIMACION[estimacion.estado]} · ${estimacion.modo}`}</span>
            </p>
          </div>
        </div>
        {!enCurso && estimacion.estado !== 'aprobada' && (
          <button type="button" className={secundarioClass} disabled={ocupado} onClick={estimar}>
            <Bot aria-hidden className="mr-1 inline size-4" />
            Estimar con IA
          </button>
        )}
      </div>

      <AvisoMensaje aviso={aviso} />
      {enCurso && (
        <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {estimacion.progreso
            ? `Buscando evidencia: ${estimacion.progreso.hechos} de ${estimacion.progreso.total} subfactores`
            : 'Buscando evidencia…'}
        </p>
      )}
      {estimacion.error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{estimacion.error}</p>
      )}

      <section className="mb-5 rounded-2xl bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Subfactores y citas</h2>
        <table aria-label="Citas por subfactor" className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Subfactor</th>
              <th className="px-4 py-3 font-medium">Citas</th>
              <th className="px-4 py-3 font-medium">DOI</th>
            </tr>
          </thead>
          <tbody>
            {estimacion.subfactores.map((sub) => (
              <tr key={sub.id} className="border-t border-slate-100 text-slate-700">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-900">
                  {sub.texto}
                </th>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Citas de ${sub.texto}`}
                    disabled={!editable || ocupado}
                    value={valorDe(sub)}
                    onChange={(event) => setCitas((actuales) => ({ ...actuales, [sub.id]: event.target.value }))}
                    className={`${campoClass} w-24`}
                  />
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {sub.dois.length > 0 ? sub.dois.join(', ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mb-5">
        <IndicadoresIs datos={enVivo} cortes={estimacion.cortes} />
      </div>

      {editable ? (
        <section className="rounded-2xl bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Decisión</h2>
          <div className="grid grid-cols-[12rem_1fr] gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              IS aprobada
              <select
                className={campoClass}
                value={isAprobar ?? ''}
                onChange={(event) => setIsElegida(Number(event.target.value))}
              >
                {VALORES.map((valor) => (
                  <option key={valor} value={valor}>
                    {`${valor} · ${ETIQUETA_IMPORTANCIA[valor]}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Justificación
              <textarea
                rows={2}
                className={campoClass}
                value={justificacion}
                placeholder="Obligatoria para rechazar o para aprobar una IS distinta de la calculada"
                onChange={(event) => setJustificacion(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" className={secundarioClass} disabled={ocupado} onClick={rechazar}>
              Rechazar
            </button>
            <button type="button" className={botonClass} disabled={ocupado} onClick={aprobar}>
              Aprobar
            </button>
          </div>
        </section>
      ) : (
        estimacion.estado !== 'en_curso' && (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">
            {estimacion.estado === 'aprobada'
              ? `IS aprobada: ${estimacion.isAprobada}. El factor quedó activo en una nueva versión del catálogo.`
              : 'Estimación rechazada: el factor sigue inactivo.'}
            {estimacion.justificacion && ` Justificación: ${estimacion.justificacion}`}
          </p>
        )
      )}
    </div>
  )
}

function CargarEstimacion({ id }: { id: number }) {
  const cargar = useCallback(() => obtenerEstimacion(id), [id])
  const { datos, cargando, error } = useCarga(cargar)
  if (!datos) return <EstadoCarga cargando={cargando} error={error} />
  return <Detalle inicial={datos} />
}

/** IS estimation of a new factor (RF-24): review, correct the citations, approve or reject. */
export function EstimacionPage() {
  const { id } = useParams()
  // `key` reloads everything when an AI estimation opens a new one.
  return <CargarEstimacion key={id} id={Number(id)} />
}
