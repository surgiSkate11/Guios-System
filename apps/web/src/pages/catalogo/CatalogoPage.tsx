import { ChevronDown, ChevronRight, ListChecks, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import {
  listarEstimaciones,
  listarVersionesCatalogo,
  obtenerCatalogo,
  type CatalogoVigente,
  type FactorCatalogo,
  type OrigenFactor,
} from '../../api/catalogo'
import { useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { EstadoCarga } from '../../components/ui'
import { ESTILO_IMPORTANCIA, ETIQUETA_IMPORTANCIA } from '../evaluacion/escalas'
import { formatearFecha } from '../proyectos/formato'
import { AdministrarFactores } from './AdministrarFactores'
import { ETIQUETA_ESTADO_ESTIMACION } from './formato'

const ETIQUETA_ORIGEN: Record<OrigenFactor, string> = { tesis: 'tesis', lit_2020_2025: 'lit 2020-2025' }
const ETIQUETA_ALCANCE = { interno: 'Interno', externo: 'Externo' } as const
const chip = 'inline-block rounded-full px-2.5 py-0.5 text-xs'
const thClass = 'px-4 py-3 font-medium'

function FilaFactor({ factor }: { factor: FactorCatalogo }) {
  const [abierto, setAbierto] = useState(false)
  const Icono = abierto ? ChevronDown : ChevronRight
  return (
    <>
      <tr className="border-t border-slate-100 text-slate-700">
        <th scope="row" className="px-4 py-2.5 text-left font-normal text-slate-900">
          <span className="inline-flex items-center gap-1">
            {factor.nombre}
            <button
              type="button"
              aria-expanded={abierto}
              aria-label={`Ver subfactores de ${factor.nombre}`}
              onClick={() => setAbierto((valor) => !valor)}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
            >
              <Icono aria-hidden className="size-4" />
            </button>
          </span>
        </th>
        <td className="px-4 py-2.5">
          <span className={`${chip} ${ESTILO_IMPORTANCIA[factor.sugeridaDefault] ?? ''}`}>
            {ETIQUETA_IMPORTANCIA[factor.sugeridaDefault] ?? factor.sugeridaDefault}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`${chip} bg-blue-50 text-blue-700`}>{ETIQUETA_ALCANCE[factor.alcanceDefault]}</span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`${chip} bg-violet-50 text-violet-700`}>{ETIQUETA_ORIGEN[factor.origen] ?? factor.origen}</span>
        </td>
        <td className="px-4 py-2.5">
          {factor.validadoExpertos ? (
            <span className={`${chip} bg-green-50 text-green-800`}>Sí</span>
          ) : (
            <span className={`${chip} bg-amber-100 text-amber-800`}>No validado</span>
          )}
        </td>
        <td className="px-4 py-2.5">{factor.subfactores.length}</td>
      </tr>
      {abierto &&
        factor.subfactores.map((subfactor) => (
          <tr key={subfactor.id} className="border-t border-slate-50 text-slate-600">
            <td colSpan={6} className="py-2 pr-4 pl-10">
              {subfactor.texto}
            </td>
          </tr>
        ))}
    </>
  )
}

function Dimension({
  dimension,
  inicialAbierta,
}: {
  dimension: CatalogoVigente['dimensiones'][number]
  inicialAbierta: boolean
}) {
  const [abierta, setAbierta] = useState(inicialAbierta)
  const cantidad = dimension.factores.length
  const Icono = abierta ? ChevronDown : ChevronRight
  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta((valor) => !valor)}
        className="flex w-full items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-left"
      >
        <Icono aria-hidden className="size-4 text-slate-500" />
        <span className="font-semibold text-slate-900">{dimension.nombre}</span>
        <span className="text-xs text-slate-500">
          {cantidad} {cantidad === 1 ? 'factor' : 'factores'}
        </span>
      </button>
      {abierta && (
        <table aria-label={`Factores de ${dimension.nombre}`} className="mt-2 w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className={thClass}>Factor</th>
              <th className={thClass}>Importancia sugerida</th>
              <th className={thClass}>Alcance por defecto</th>
              <th className={thClass}>Origen</th>
              <th className={thClass}>Validado por expertos</th>
              <th className={thClass}>Subfactores</th>
            </tr>
          </thead>
          <tbody>
            {dimension.factores.map((factor) => (
              <FilaFactor key={factor.id} factor={factor} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Versiones() {
  const { datos, cargando, error } = useCarga(listarVersionesCatalogo)
  if (!datos) return <EstadoCarga cargando={cargando} error={error} />
  return (
    <table aria-label="Versiones del catálogo" className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs text-slate-500">
        <tr>
          <th className={thClass}>Versión</th>
          <th className={thClass}>Fecha</th>
          <th className={thClass}>Motivo</th>
        </tr>
      </thead>
      <tbody>
        {datos.map((version) => (
          <tr key={version.id} className="border-t border-slate-100 text-slate-700">
            <td className="px-4 py-2.5">Versión {version.numero}</td>
            <td className="px-4 py-2.5">{formatearFecha(version.fecha.slice(0, 10))}</td>
            <td className="px-4 py-2.5">{version.motivo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Estimations still waiting for a decision (AI in progress or proposals). */
function EstimacionesPendientes() {
  const { datos, cargando, error } = useCarga(listarEstimaciones)
  const pendientes = (datos ?? []).filter((item) => item.estado === 'en_curso' || item.estado === 'propuesta')
  return (
    <section aria-labelledby="estimaciones-pendientes" className="mb-5 rounded-2xl bg-white p-5">
      <h2 id="estimaciones-pendientes" className="mb-3 font-semibold text-slate-900">
        Estimaciones pendientes
      </h2>
      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : pendientes.length === 0 ? (
        <p className="text-sm text-slate-500">No hay estimaciones pendientes.</p>
      ) : (
        <ul className="space-y-2">
          {pendientes.map((estimacion) => (
            <li key={estimacion.id}>
              <Link
                to={`/admin/catalogo/estimaciones/${estimacion.id}`}
                className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100"
              >
                <span className="font-semibold text-slate-900">{estimacion.factor.nombre}</span>
                <span className="text-slate-600">
                  {`${ETIQUETA_ESTADO_ESTIMACION[estimacion.estado]} · ${estimacion.modo}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Factor catalog (RF-18): current version with its factors and subfactors, pending IS
 * estimations, administration of every factor, and the catalog versions.
 */
export function CatalogoPage() {
  const [version, setVersion] = useState(0)
  // A new `version` gives a new loader, so the current catalog reloads after a change.
  const cargar = useCallback(() => {
    void version
    return obtenerCatalogo()
  }, [version])
  const { datos, cargando, error } = useCarga(cargar)

  return (
    <div>
      <PageHeader
        title="Catálogo de factores"
        subtitle="Factores, subfactores y versiones del catálogo"
        icon={ListChecks}
        actions={
          datos && (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Versión de catálogo {datos.version.numero}
              </span>
              <Link
                to="/admin/catalogo/factores/nuevo"
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus aria-hidden className="size-4" />
                Nuevo factor
              </Link>
            </div>
          )
        }
      />
      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Cortes: rq1 {datos.version.rq1.toFixed(2)} · rq2 {datos.version.rq2.toFixed(2)} · rq3{' '}
            {datos.version.rq3.toFixed(2)}
          </p>
          <EstimacionesPendientes />
          <section className="mb-5 rounded-2xl bg-white p-5">
            {datos.dimensiones.map((dimension, indice) => (
              <Dimension key={dimension.id} dimension={dimension} inicialAbierta={indice === 0} />
            ))}
          </section>
          <AdministrarFactores onCambio={() => setVersion((valor) => valor + 1)} />
          <section className="rounded-2xl bg-white p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Versiones del catálogo</h2>
            <Versiones />
          </section>
        </>
      )}
    </div>
  )
}
