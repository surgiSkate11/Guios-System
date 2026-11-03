import { Check } from 'lucide-react'
import { useCallback, useState } from 'react'
import { guardarImportancia, listarMisImportancias, type Valor } from '../../api/evaluacion'
import type { ProyectoResumen } from '../../api/proyectos'
import { avisoDeError, useCarga } from '../../components/carga'
import { AvisoMensaje, EstadoCarga, type Aviso } from '../../components/ui'
import { errorDePaso } from './errores'
import { PasosEvaluacion } from './PasosEvaluacion'
import { ETIQUETA_IMPORTANCIA, ESTILO_IMPORTANCIA, VALORES } from './escalas'

function TablaImportancias({ proyecto }: { proyecto: ProyectoResumen }) {
  const cargar = useCallback(() => listarMisImportancias(proyecto.id), [proyecto.id])
  const { datos, cargando, error, status, actualizar } = useCarga(cargar)
  const [aviso, setAviso] = useState<Aviso>(null)
  const soloLectura = proyecto.estado !== 'en_curso'

  if (!datos) return <EstadoCarga cargando={cargando} error={errorDePaso(error, status)} />

  const evaluados = datos.filter((fila) => fila.impDecisor !== null).length

  // Saves on click; the value is shown at once and restored if the server rejects it.
  async function elegir(idProyectoFactor: number, nombre: string, valor: Valor) {
    const anterior = datos!.find((fila) => fila.idProyectoFactor === idProyectoFactor)!.impDecisor
    const poner = (impDecisor: number | null) =>
      actualizar((filas) =>
        filas.map((fila) => (fila.idProyectoFactor === idProyectoFactor ? { ...fila, impDecisor } : fila)),
      )
    poner(valor)
    setAviso(null)
    try {
      await guardarImportancia(proyecto.id, idProyectoFactor, valor)
      setAviso({ tipo: 'ok', texto: `Importancia de ${nombre} guardada` })
    } catch (failure) {
      poner(anterior)
      setAviso(avisoDeError(failure))
    }
  }

  return (
    <>
      <p className="mb-4 text-sm text-slate-600">
        Asigna la importancia que tiene cada factor para tu organización. La importancia relativa y el
        alcance se calculan al consolidar a todos los jurados.
      </p>
      <AvisoMensaje aviso={aviso} />
      <section className="rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Factores de evaluación</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-brand-700">
              <Check aria-hidden className="size-3.5" />
              Guardado automático
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-blue-700">
              {evaluados} de {datos.length} factores evaluados
            </span>
          </div>
        </div>
        <table aria-label="Factores de evaluación" className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Factor</th>
              <th className="px-4 py-3 font-medium">Dimensión</th>
              <th className="px-4 py-3 font-medium">Imp. sugerida</th>
              <th className="px-4 py-3 font-medium">Imp. decisor</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((fila) => (
              <tr key={fila.idProyectoFactor} className="border-t border-slate-100">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-800">
                  {fila.factor.nombre}
                </th>
                <td className="px-4 py-2.5 text-slate-600">{fila.dimension.nombre}</td>
                <td className="px-4 py-2.5">
                  <span
                    data-sugerida
                    className={`rounded-full px-2.5 py-0.5 text-xs ${ESTILO_IMPORTANCIA[fila.impSugerida] ?? ''}`}
                  >
                    {ETIQUETA_IMPORTANCIA[fila.impSugerida] ?? fila.impSugerida}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div
                    role="group"
                    aria-label={`Importancia de ${fila.factor.nombre}`}
                    className="inline-flex rounded-lg bg-slate-100 p-0.5"
                  >
                    {VALORES.map((valor) => {
                      const elegido = fila.impDecisor === valor
                      return (
                        <button
                          key={valor}
                          type="button"
                          aria-pressed={elegido}
                          disabled={soloLectura}
                          onClick={() => void elegir(fila.idProyectoFactor, fila.factor.nombre, valor)}
                          className={`rounded-md px-2.5 py-1 text-xs disabled:cursor-not-allowed ${
                            elegido ? 'bg-brand-600 font-semibold text-white' : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          {ETIQUETA_IMPORTANCIA[valor]}
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

/** Steps 1 and 2 of the judge (HU-02): decision-maker importance of each factor. */
export function ImportanciaPage() {
  return <PasosEvaluacion>{(proyecto) => <TablaImportancias proyecto={proyecto} />}</PasosEvaluacion>
}
