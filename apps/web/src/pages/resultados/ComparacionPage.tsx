import { Flag, GitCompareArrows } from 'lucide-react'
import { useCallback } from 'react'
import { useParams } from 'react-router'
import { obtenerProyecto } from '../../api/proyectos'
import {
  generarResultados,
  obtenerVistaPrevia,
  type ResultadoProyecto,
  type SoftwareResultado,
} from '../../api/resultados'
import { useAccion, useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { SelectorProyecto } from '../../components/SelectorProyecto'
import { AvisoMensaje, botonClass, EstadoCarga } from '../../components/ui'
import { NivelEtiqueta } from './Etiquetas'
import { BANDERAS, formatearMomento, uno } from './formato'

const thClass = 'px-4 py-3 font-medium'

function resumenFoda(software: SoftwareResultado) {
  const contar = (foda: string) => software.factores.filter((factor) => factor.foda === foda).length
  return [
    ['F', contar('fortaleza')],
    ['D', contar('debilidad')],
    ['O', contar('oportunidad')],
    ['A', contar('amenaza')],
  ] as const
}

function Ranking({ resultado }: { resultado: ResultadoProyecto }) {
  const ordenados = [...resultado.softwares].sort((a, b) => a.ranking - b.ranking)
  return (
    <section className="mb-5 rounded-2xl bg-white p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Ranking de softwares</h2>
      <table aria-label="Ranking de softwares" className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            {['Posición', 'Software', 'Métrica final', 'Mín', 'Máx', 'Desviación', 'Nivel de adopción', 'FODA resumido'].map(
              (cabecera) => (
                <th key={cabecera} className={thClass}>
                  {cabecera}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((software) => (
            <tr key={software.id} className="border-t border-slate-100 text-slate-700">
              <td className="px-4 py-3">
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-800">
                  {software.ranking}°
                </span>
              </td>
              <td className="px-4 py-3 text-slate-900">{software.nombre}</td>
              <td className="px-4 py-3">{uno(software.metrica.final)}</td>
              <td className="px-4 py-3">{uno(software.metrica.minimo)}</td>
              <td className="px-4 py-3">{uno(software.metrica.maximo)}</td>
              <td className="px-4 py-3">{uno(software.metrica.desviacion)}</td>
              <td className="px-4 py-3">
                <NivelEtiqueta nivel={software.nivel} />
              </td>
              <td className="space-x-1.5 px-4 py-3">
                {resumenFoda(software).map(([letra, cantidad]) => (
                  <span key={letra} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {letra} {cantidad}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function MetricaPorJurado({ resultado }: { resultado: ResultadoProyecto }) {
  return (
    <section aria-labelledby="metrica-por-jurado" className="mb-5 rounded-2xl bg-white p-5">
      <h2 id="metrica-por-jurado" className="mb-4 font-semibold text-slate-900">
        Métrica final por jurado
      </h2>
      <div className="grid grid-cols-2 gap-8">
        {resultado.softwares.map((software) => (
          <div key={software.id} role="group" aria-label={software.nombre}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{software.nombre}</h3>
            <ul className="space-y-1.5">
              {software.scoresJurado.map((jurado) => (
                <li key={jurado.idUsuario} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-xs">
                  <span className="text-slate-600">{jurado.nombre}</span>
                  {jurado.score === null ? (
                    <span className="text-slate-400">Sin métrica</span>
                  ) : (
                    <div
                      role="meter"
                      aria-label={jurado.nombre}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={jurado.score}
                      className="h-2.5 rounded-full bg-slate-100"
                    >
                      <div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${jurado.score}%` }} />
                    </div>
                  )}
                  <span className="font-semibold text-slate-800">{uno(jurado.score)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Banderas({ resultado }: { resultado: ResultadoProyecto }) {
  const detectadas = new Set(resultado.banderas.map((bandera) => bandera.tipo))
  return (
    <section aria-labelledby="banderas" className="rounded-2xl bg-white p-5">
      <h2 id="banderas" className="mb-3 font-semibold text-slate-900">
        Banderas de ambigüedad
      </h2>
      <div className="flex flex-wrap gap-2">
        {BANDERAS.map(({ tipo, etiqueta }) => {
          const detectada = detectadas.has(tipo)
          return (
            <span
              key={tipo}
              data-detectada={detectada}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                detectada ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Flag aria-hidden className="size-3" />
              {etiqueta}
            </span>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">Naranja: bandera detectada · Gris: no detectada</p>
      {resultado.banderas.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          {resultado.banderas.map((bandera, indice) => (
            <li key={indice}>{bandera.mensaje}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Comparacion({ id }: { id: number }) {
  const cargarProyecto = useCallback(() => obtenerProyecto(id), [id])
  const proyecto = useCarga(cargarProyecto)
  const cargar = useCallback(() => obtenerVistaPrevia(id), [id])
  const { datos, cargando, error, actualizar } = useCarga(cargar)
  const { aviso, ocupado, ejecutar } = useAccion()

  const generar = () =>
    ejecutar(async () => {
      const generado = await generarResultados(id)
      actualizar(() => generado)
      return 'Resultados generados'
    })

  const subtitulo = proyecto.datos
    ? `Ranking por métrica final del proyecto "${proyecto.datos.nombre}"`
    : 'Ranking por métrica final'

  return (
    <div>
      <PageHeader
        title="Comparación de softwares"
        subtitle={subtitulo}
        icon={GitCompareArrows}
        actions={
          datos &&
          proyecto.datos?.estado !== 'cerrado' && (
            <button type="button" className={botonClass} disabled={ocupado} onClick={() => void generar()}>
              Generar resultados
            </button>
          )
        }
      />
      <AvisoMensaje aviso={aviso} />
      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {datos.generadoEn
              ? `Generado el ${formatearMomento(datos.generadoEn)}`
              : 'Vista previa: los resultados todavía no se generaron'}
          </p>
          <Ranking resultado={datos} />
          <MetricaPorJurado resultado={datos} />
          <Banderas resultado={datos} />
        </>
      )}
    </div>
  )
}

/** Software comparison of a project (HU-07, HU-08); only its coordinator opens it. */
export function ComparacionPage() {
  const { id } = useParams()
  return <Comparacion key={id} id={Number(id)} />
}

/** Menu entry: the projects I coordinate. */
export function ComparacionSelectorPage() {
  return (
    <SelectorProyecto
      title="Comparación de softwares"
      subtitle="Elegí el proyecto a comparar"
      icon={GitCompareArrows}
      filtro={(proyecto) => proyecto.miRol === 'coordinador'}
      pantalla="comparacion"
      vacio="No coordinás ningún proyecto."
    />
  )
}
