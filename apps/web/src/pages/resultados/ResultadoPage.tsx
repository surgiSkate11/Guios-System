import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ProyectoResumen } from '../../api/proyectos'
import { obtenerMiResultado, obtenerResultados } from '../../api/resultados'
import { useCarga } from '../../components/carga'
import { EstadoCarga } from '../../components/ui'
import { PasosEvaluacion } from '../evaluacion/PasosEvaluacion'
import { errorDePaso } from '../evaluacion/errores'
import { FodaEtiqueta, NivelEtiqueta, PestanasSoftware } from './Etiquetas'
import { ExportarPdf } from './ExportarPdf'
import { ETIQUETA_ALCANCE, uno } from './formato'

const thClass = 'px-4 py-3 font-medium'

function pm(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(1)} / 4`
}

function TablaFoda({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Análisis FODA por factor</h2>
      <table aria-label="Análisis FODA por factor" className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            {cabeceras.map((cabecera) => (
              <th key={cabecera} className={thClass}>
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  )
}

function Metrica({ titulo, valor, children }: { titulo: string; valor: number | null; children?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5">
      <h2 className="font-semibold text-slate-900">{titulo}</h2>
      <p data-testid="metrica" className="mt-3 text-5xl font-bold text-slate-900">
        {uno(valor)} <span className="text-lg font-normal text-slate-500">/ 100</span>
      </p>
      {valor !== null && (
        <div className="mt-3 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-brand-600" style={{ width: `${valor}%` }} />
        </div>
      )}
      {children}
    </section>
  )
}

function Dato({ nombre, valor }: { nombre: string; valor: number }) {
  return (
    <div role="group" aria-label={nombre}>
      <p className="text-xs text-slate-500">{nombre}</p>
      <p className="text-xl font-bold text-slate-900">{uno(valor)}</p>
    </div>
  )
}

/** The judge's own result (A6 resultados/mio): score, PM and SWOT per software. */
function ResultadoJurado({ proyecto }: { proyecto: ProyectoResumen }) {
  const cargar = useCallback(() => obtenerMiResultado(proyecto.id), [proyecto.id])
  const { datos, cargando, error, status } = useCarga(cargar)
  const [idSoftware, setIdSoftware] = useState<number | null>(null)

  if (!datos) return <EstadoCarga cargando={cargando} error={errorDePaso(error, status)} />
  const software = datos.softwares.find((item) => item.id === idSoftware) ?? datos.softwares[0]
  if (!software) return <p className="text-sm text-slate-500">El proyecto no tiene softwares.</p>

  return (
    <>
      <PestanasSoftware softwares={datos.softwares} activo={software.id} onCambio={setIdSoftware} />
      <div className="grid grid-cols-[1fr_20rem] gap-5">
        <TablaFoda cabeceras={['Factor', 'Ponderación media', 'FODA']}>
          {software.factores.map((factor) => (
            <tr key={factor.idProyectoFactor} className="border-t border-slate-100">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-800">
                {factor.nombre}
              </th>
              <td className="px-4 py-2.5">{pm(factor.pm)}</td>
              <td className="px-4 py-2.5">
                <FodaEtiqueta foda={factor.foda} />
              </td>
            </tr>
          ))}
        </TablaFoda>
        <Metrica titulo="Tu métrica" valor={software.score} />
      </div>
    </>
  )
}

/** The coordinator's consolidated result: the last generated report (A6). */
function ResultadoConsolidado({ proyecto }: { proyecto: ProyectoResumen }) {
  const cargar = useCallback(() => obtenerResultados(proyecto.id), [proyecto.id])
  const { datos, cargando, error, status } = useCarga(cargar)
  const [idSoftware, setIdSoftware] = useState<number | null>(null)

  if (status === 404) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-600">
        <p>Aún no hay resultados</p>
        <Link
          to={`/proyectos/${proyecto.id}/comparacion`}
          className="mt-2 inline-block font-medium text-blue-600 hover:underline"
        >
          Ir a la comparación
        </Link>
      </div>
    )
  }
  if (!datos) return <EstadoCarga cargando={cargando} error={error} />
  const software = datos.softwares.find((item) => item.id === idSoftware) ?? datos.softwares[0]
  if (!software) return <p className="text-sm text-slate-500">El proyecto no tiene softwares.</p>

  return (
    <>
      <div className="flex items-start justify-between">
        <PestanasSoftware softwares={datos.softwares} activo={software.id} onCambio={setIdSoftware} />
        <ExportarPdf idProyecto={proyecto.id} />
      </div>
      <div className="grid grid-cols-[1fr_20rem] gap-5">
        <TablaFoda cabeceras={['Factor', 'Ponderación media', 'Alcance', 'FODA']}>
          {software.factores.map((factor) => (
            <tr key={factor.idProyectoFactor} className="border-t border-slate-100">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-800">
                {factor.nombre}
              </th>
              <td className="px-4 py-2.5">{pm(factor.pmConsolidada)}</td>
              <td className="px-4 py-2.5">{ETIQUETA_ALCANCE[factor.alcance]}</td>
              <td className="px-4 py-2.5">
                <FodaEtiqueta foda={factor.foda} />
              </td>
            </tr>
          ))}
        </TablaFoda>
        <Metrica titulo="Métrica final" valor={software.metrica.final}>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Dato nombre="Mínimo" valor={software.metrica.minimo} />
            <Dato nombre="Máximo" valor={software.metrica.maximo} />
            <Dato nombre="Desviación" valor={software.metrica.desviacion} />
          </div>
          <p className="mt-4">
            <NivelEtiqueta nivel={software.nivel} largo />
          </p>
        </Metrica>
      </div>
    </>
  )
}

/** Steps 5 and 6: the judge sees their own result; the coordinator, the consolidated one. */
export function ResultadoPage() {
  return (
    <PasosEvaluacion>
      {(proyecto) =>
        proyecto.miRol === 'coordinador' ? (
          <ResultadoConsolidado proyecto={proyecto} />
        ) : (
          <ResultadoJurado proyecto={proyecto} />
        )
      }
    </PasosEvaluacion>
  )
}
