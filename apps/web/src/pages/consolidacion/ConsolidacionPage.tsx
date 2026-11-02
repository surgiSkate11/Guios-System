import { ClipboardCheck, Info } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import {
  confirmarConsolidacion,
  guardarAlcance,
  obtenerConsolidacion,
  type Alcance,
  type FactorConsolidado,
} from '../../api/consolidacion'
import { actualizarProyecto, obtenerProyecto, type Metodo } from '../../api/proyectos'
import { avisoDeError, useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { SelectorProyecto } from '../../components/SelectorProyecto'
import { AvisoMensaje, botonClass, campoClass, EstadoCarga, type Aviso } from '../../components/ui'
import { ETIQUETA_METODO } from '../proyectos/formato'

const ALCANCES: Alcance[] = ['interno', 'externo']
const ETIQUETA_ALCANCE: Record<Alcance, string> = { interno: 'Interno', externo: 'Externo' }
const METODOS: Metodo[] = ['mediana', 'promedio']

interface FilaProps {
  fila: FactorConsolidado
  jurados: { idUsuario: number; nombre: string }[]
  editable: boolean
  onGuardar: (fila: FactorConsolidado, alcance: Alcance, justificacion: string) => void
}

function FilaFactor({ fila, jurados, editable, onGuardar }: FilaProps) {
  const [alcance, setAlcance] = useState<Alcance>(fila.alcanceEfectivo)
  const [justificacion, setJustificacion] = useState(fila.justificacionAlcance ?? '')
  const nombre = fila.factor.nombre
  const reclasificado = alcance !== fila.alcanceDefault
  const atenuada = fila.esRelevante === false ? 'text-slate-400' : 'text-slate-700'

  return (
    <tr className={`border-t border-slate-100 ${atenuada}`}>
      <th scope="row" className="px-3 py-2.5 text-left font-normal text-slate-800">
        {nombre}
      </th>
      <td className="px-3 py-2.5">{fila.dimension.nombre}</td>
      {jurados.map((jurado) => {
        const importancia = fila.importancias.find((item) => item.idUsuario === jurado.idUsuario)
        return (
          <td key={jurado.idUsuario} className="px-3 py-2.5">
            {importancia?.impDecisor ?? '—'}
          </td>
        )
      })}
      <td className="px-3 py-2.5">{fila.impSugerida}</td>
      <td className="px-3 py-2.5">
        {fila.idConsolidada ?? <span className="text-amber-700">Falta {fila.faltantes}</span>}
      </td>
      <td className="px-3 py-2.5">{fila.ir ?? '—'}</td>
      <td className="px-3 py-2.5">
        {fila.esRelevante === null ? '—' : fila.esRelevante ? 'Sí' : 'No'}
      </td>
      <td className="px-3 py-2.5">
        <select
          aria-label={`Alcance de ${nombre}`}
          value={alcance}
          disabled={!editable}
          onChange={(event) => setAlcance(event.target.value as Alcance)}
          className={campoClass}
        >
          {ALCANCES.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_ALCANCE[valor]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <input
          aria-label={`Justificación de ${nombre}`}
          value={justificacion}
          disabled={!editable || !reclasificado}
          placeholder={reclasificado ? 'Obligatoria al reclasificar' : '—'}
          onChange={(event) => setJustificacion(event.target.value)}
          className={`${campoClass} w-full`}
        />
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          aria-label={`Guardar alcance de ${nombre}`}
          disabled={!editable}
          onClick={() => onGuardar(fila, alcance, justificacion)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Guardar
        </button>
      </td>
    </tr>
  )
}

function Consolidacion({ id }: { id: number }) {
  const [version, setVersion] = useState(0)
  const cargarProyecto = useCallback(() => obtenerProyecto(id), [id])
  const proyecto = useCarga(cargarProyecto)
  // A new `version` gives a new loader, so the preview reloads after the method changes.
  const cargar = useCallback(() => {
    void version
    return obtenerConsolidacion(id)
  }, [id, version])
  const { datos, cargando, error, actualizar } = useCarga(cargar)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)

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

  const titulo = (
    <PageHeader
      title="Consolidación y alcance"
      subtitle={proyecto.datos ? proyecto.datos.nombre : 'Importancias consolidadas de los jurados'}
      icon={ClipboardCheck}
    />
  )
  if (!datos) {
    return (
      <div>
        {titulo}
        <EstadoCarga cargando={cargando} error={error} />
      </div>
    )
  }

  const abierto = proyecto.datos?.estado !== 'cerrado'
  const jurados = [
    ...new Map(
      datos.factores.flatMap((fila) => fila.importancias).map((item) => [item.idUsuario, item]),
    ).values(),
  ]

  const cambiarMetodo = (metodo: Metodo) =>
    ejecutar(async () => {
      await actualizarProyecto(id, { metodoConsolidacion: metodo })
      setVersion((valor) => valor + 1)
      return `Método de consolidación: ${ETIQUETA_METODO[metodo]}`
    })

  const confirmar = () =>
    ejecutar(async () => {
      const confirmada = await confirmarConsolidacion(id)
      actualizar(() => confirmada)
      return 'Consolidación confirmada'
    })

  function guardar(fila: FactorConsolidado, alcance: Alcance, justificacion: string) {
    const reclasificado = alcance !== fila.alcanceDefault
    if (reclasificado && justificacion.trim() === '') {
      setAviso({ tipo: 'error', texto: `Justificación requerida para reclasificar ${fila.factor.nombre}` })
      return
    }
    void ejecutar(async () => {
      const body = reclasificado ? { alcance, justificacion: justificacion.trim() } : { alcance }
      const guardada = await guardarAlcance(id, fila.idProyectoFactor, body)
      actualizar((actual) => ({
        ...actual,
        factores: actual.factores.map((item) =>
          item.idProyectoFactor === fila.idProyectoFactor ? { ...item, ...guardada } : item,
        ),
      }))
      return `Alcance de ${fila.factor.nombre} guardado`
    })
  }

  return (
    <div>
      {titulo}
      <fieldset className="mb-5 flex items-center gap-4">
        <legend className="sr-only">Método de consolidación</legend>
        <span aria-hidden className="text-sm text-slate-700">
          Método de consolidación
        </span>
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {METODOS.map((metodo) => (
            <label
              key={metodo}
              className={`cursor-pointer rounded-md px-4 py-1.5 text-sm has-disabled:cursor-not-allowed ${
                datos.metodo === metodo ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              <input
                type="radio"
                name="metodo"
                className="sr-only"
                checked={datos.metodo === metodo}
                disabled={datos.confirmada || !abierto || ocupado}
                onChange={() => void cambiarMetodo(metodo)}
              />
              {ETIQUETA_METODO[metodo]}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mb-5 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info aria-hidden className="size-4" />
        Los factores relevantes y los pesos se aplican a todos los softwares del proyecto
      </p>
      <AvisoMensaje aviso={aviso} />
      <section className="overflow-x-auto rounded-2xl bg-white p-5">
        <table aria-label="Consolidación de importancias" className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Factor</th>
              <th className="px-3 py-3 font-medium">Dimensión</th>
              {jurados.map((jurado) => (
                <th key={jurado.idUsuario} className="px-3 py-3 font-medium">
                  {jurado.nombre}
                </th>
              ))}
              <th className="px-3 py-3 font-medium">Imp. sugerida</th>
              <th className="px-3 py-3 font-medium">Consolidado</th>
              <th className="px-3 py-3 font-medium">IR</th>
              <th className="px-3 py-3 font-medium">Relevante</th>
              <th className="px-3 py-3 font-medium">Alcance</th>
              <th className="px-3 py-3 font-medium">Justificación (obligatoria si se reclasifica)</th>
              <th className="px-3 py-3 font-medium">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.factores.map((fila) => (
              <FilaFactor
                key={fila.idProyectoFactor}
                fila={fila}
                jurados={jurados}
                editable={abierto && !ocupado}
                onGuardar={guardar}
              />
            ))}
          </tbody>
        </table>
      </section>
      {abierto && !datos.confirmada && (
        <div className="mt-5 flex justify-end">
          <button type="button" className={botonClass} disabled={ocupado} onClick={() => void confirmar()}>
            Confirmar consolidación
          </button>
        </div>
      )}
      {datos.confirmada && (
        <p className="mt-5 text-right text-sm font-medium text-brand-700">
          Consolidación confirmada: los jurados ya pueden calificar los subfactores.
        </p>
      )}
    </div>
  )
}

/** Consolidation and scope of a project (HU-03, HU-04); only its coordinator opens it. */
export function ConsolidacionPage() {
  const { id } = useParams()
  return <Consolidacion key={id} id={Number(id)} />
}

/** Menu entry: the projects I coordinate. */
export function ConsolidacionSelectorPage() {
  return (
    <SelectorProyecto
      title="Consolidación y alcance"
      subtitle="Elegí el proyecto a consolidar"
      icon={ClipboardCheck}
      filtro={(proyecto) => proyecto.miRol === 'coordinador'}
      pantalla="consolidacion"
      vacio="No coordinás ningún proyecto."
    />
  )
}
