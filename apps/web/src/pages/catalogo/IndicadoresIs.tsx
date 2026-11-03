import { TriangleAlert } from 'lucide-react'
import { ETIQUETA_IMPORTANCIA } from '../evaluacion/escalas'
import type { IsEnVivo } from './is-en-vivo'

function Indicador({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div role="group" aria-label={nombre} className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{nombre}</p>
      <p className="text-xl font-bold text-slate-900">{valor}</p>
    </div>
  )
}

/** Live TC, NS, r, IL and IS of a factor with the anchors' cut points and the warnings. */
export function IndicadoresIs({
  datos,
  cortes,
}: {
  datos: IsEnVivo
  cortes: { rq1: number; rq2: number; rq3: number }
}) {
  const { calculo } = datos
  return (
    <section aria-label="Importancia sugerida calculada" className="rounded-2xl bg-white p-5">
      <div className="grid grid-cols-5 gap-3">
        <Indicador nombre="TC" valor={calculo ? String(datos.tc) : '—'} />
        <Indicador nombre="NS" valor={String(datos.ns)} />
        <Indicador nombre="r" valor={calculo ? calculo.r.toFixed(2) : '—'} />
        <Indicador nombre="IL" valor={calculo ? String(calculo.il) : '—'} />
        <Indicador
          nombre="IS"
          valor={calculo ? `${calculo.is} · ${ETIQUETA_IMPORTANCIA[calculo.is]}` : '—'}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {`Cortes: rq1 ${cortes.rq1.toFixed(2)} · rq2 ${cortes.rq2.toFixed(2)} · rq3 ${cortes.rq3.toFixed(2)}`}
      </p>
      {!calculo && (
        <p className="mt-2 text-xs text-amber-700">Las citas deben ser enteros mayores o iguales a 0.</p>
      )}
      {datos.avisos.length > 0 && (
        <ul aria-label="Avisos" className="mt-3 space-y-2">
          {datos.avisos.map((aviso) => (
            <li
              key={aviso}
              className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              {aviso}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
