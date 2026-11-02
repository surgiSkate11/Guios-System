import { DESCONOZCO, ponderacionMediaJurado, type Calificacion } from '@guios/calculo'
import { Check } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  guardarCalificacion,
  obtenerMisCalificaciones,
  type FactorCalificado,
  type NuevaCalificacion,
  type SubfactorCalificado,
  type Valor,
} from '../../api/evaluacion'
import type { ProyectoResumen } from '../../api/proyectos'
import { avisoDeError, useCarga } from '../../components/carga'
import { AvisoMensaje, campoClass, EstadoCarga, type Aviso } from '../../components/ui'
import { formatearPm, VALORES } from './escalas'
import { errorDePaso } from './errores'
import { PasosEvaluacion } from './PasosEvaluacion'

/** PM shown while the server answers, computed with the shared rule RN-07 (RNF-03). */
function pmLocal(subfactores: SubfactorCalificado[]): number | null {
  const respuestas: Calificacion[] = subfactores
    .filter((sub) => sub.respondido)
    .map((sub) => (sub.desconozco ? DESCONOZCO : sub.valor!))
  return respuestas.length === 0 ? null : ponderacionMediaJurado(respuestas)
}

function resultadoSubfactor(sub: SubfactorCalificado): string {
  if (sub.desconozco) return 'Desconozco'
  return sub.valor === null ? '—' : `${sub.valor} / 4`
}

function faltantesTexto(factores: FactorCalificado[]): string {
  const faltan = factores.filter((factor) => factor.subfactores.some((sub) => !sub.respondido)).length
  if (faltan === 0) return 'Todos los factores están evaluados'
  return faltan === 1 ? 'Te falta 1 factor por evaluar' : `Te faltan ${faltan} factores por evaluar`
}

function Calificaciones({ proyecto }: { proyecto: ProyectoResumen }) {
  const [idSoftware, setIdSoftware] = useState(proyecto.softwares[0]?.id ?? 0)
  const [idFactor, setIdFactor] = useState<number | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const cargar = useCallback(() => obtenerMisCalificaciones(proyecto.id, idSoftware), [proyecto.id, idSoftware])
  const { datos, cargando, error, status, actualizar } = useCarga(cargar)
  const soloLectura = proyecto.estado !== 'en_curso'

  if (proyecto.softwares.length === 0) {
    return <p className="text-sm text-slate-500">El proyecto no tiene softwares para calificar.</p>
  }
  if (!datos) return <EstadoCarga cargando={cargando} error={errorDePaso(error, status)} />
  if (datos.factores.length === 0) {
    return <p className="text-sm text-slate-500">No tenés factores relevantes para calificar.</p>
  }

  const factor = datos.factores.find((item) => item.idProyectoFactor === idFactor) ?? datos.factores[0]!
  const software = datos.software

  const reemplazar = (cambio: FactorCalificado) =>
    actualizar((actual) => ({
      ...actual,
      factores: actual.factores.map((item) =>
        item.idProyectoFactor === cambio.idProyectoFactor ? cambio : item,
      ),
    }))

  // Saves on click (HU-05): the answer and its PM show at once; the server PM is official.
  async function responder(sub: SubfactorCalificado, respuesta: { valor: Valor } | { desconozco: true }) {
    const anterior = factor
    const subfactores = factor.subfactores.map((item) =>
      item.id === sub.id
        ? 'valor' in respuesta
          ? { ...item, valor: respuesta.valor, desconozco: false, respondido: true }
          : { ...item, valor: null, desconozco: true, respondido: true }
        : item,
    )
    const optimista = { ...factor, subfactores, pm: pmLocal(subfactores) }
    reemplazar(optimista)
    setAviso(null)
    const body = { idSoftware: software.id, idSubfactor: sub.id, ...respuesta } as NuevaCalificacion
    try {
      const { pm } = await guardarCalificacion(proyecto.id, body)
      reemplazar({ ...optimista, pm })
    } catch (failure) {
      reemplazar(anterior)
      setAviso(avisoDeError(failure))
    }
  }

  return (
    <>
      <p className="mb-4 text-sm text-slate-600">
        Calificá los subfactores de cada factor relevante para cada software.
      </p>
      <AvisoMensaje aviso={aviso} />
      <div className="mb-5 flex flex-wrap items-end gap-5 rounded-2xl bg-white p-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
          Software
          <select
            value={idSoftware}
            onChange={(event) => setIdSoftware(Number(event.target.value))}
            className={`${campoClass} min-w-56`}
          >
            {proyecto.softwares.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
          Factor
          <select
            value={factor.idProyectoFactor}
            onChange={(event) => setIdFactor(Number(event.target.value))}
            className={`${campoClass} min-w-64`}
          >
            {datos.factores.map((item) => (
              <option key={item.idProyectoFactor} value={item.idProyectoFactor}>
                {item.factor.nombre}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-sm font-semibold text-slate-800">{faltantesTexto(datos.factores)}</p>
      </div>

      <section className="rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            Subfactores de {factor.factor.nombre} · {software.nombre}
          </h2>
          <span className="flex items-center gap-1 text-xs text-brand-700">
            <Check aria-hidden className="size-3.5" />
            Guardado inmediato
          </span>
        </div>
        <table aria-label={`Subfactores de ${factor.factor.nombre} · ${software.nombre}`} className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Subfactor</th>
              <th className="px-4 py-3 font-medium">Calificación</th>
              <th className="px-4 py-3 font-medium">Desconozco</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {factor.subfactores.map((sub) => (
              <tr key={sub.id} className="border-t border-slate-100">
                <th scope="row" className="px-4 py-3 text-left font-normal text-slate-800">
                  {sub.texto}
                </th>
                <td className="px-4 py-3">
                  <div
                    role="group"
                    aria-label={`Calificación de ${sub.texto}`}
                    className="inline-flex rounded-lg bg-slate-100 p-0.5"
                  >
                    {VALORES.map((valor) => {
                      const elegido = !sub.desconozco && sub.valor === valor
                      return (
                        <button
                          key={valor}
                          type="button"
                          aria-pressed={elegido}
                          disabled={soloLectura}
                          onClick={() => void responder(sub, { valor })}
                          className={`w-11 rounded-md py-1 text-sm disabled:cursor-not-allowed ${
                            elegido ? 'bg-brand-600 font-semibold text-white' : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          {valor}
                        </button>
                      )
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Desconozco: ${sub.texto}`}
                    checked={sub.desconozco}
                    disabled={soloLectura}
                    // Unchecking means nothing to the API; the judge picks a value instead.
                    onChange={(event) => {
                      if (event.target.checked) void responder(sub, { desconozco: true })
                    }}
                    className="size-4 accent-brand-600"
                  />
                </td>
                <td className="px-4 py-3 text-slate-700">{resultadoSubfactor(sub)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-4 text-brand-700">
          <span className="text-sm">
            Ponderación media del factor {factor.factor.nombre} ({software.nombre})
          </span>
          <span data-testid="pm" className="text-xl font-bold">
            {formatearPm(factor.pm)}
          </span>
        </div>
      </section>
    </>
  )
}

/** Steps 3 and 4 of the judge (HU-05): subfactor ratings saved on click, with the factor PM. */
export function SubfactoresPage() {
  return <PasosEvaluacion>{(proyecto) => <Calificaciones proyecto={proyecto} />}</PasosEvaluacion>
}
