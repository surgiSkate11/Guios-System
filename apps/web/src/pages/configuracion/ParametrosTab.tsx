import { useState, type FormEvent } from 'react'
import {
  guardarParametros,
  obtenerParametros,
  type Metodo,
  type Parametros,
} from '../../api/admin'
import {
  AvisoMensaje,
  botonClass,
  campoClass,
  EstadoCarga,
  type Aviso,
} from '../../components/ui'
import { avisoDeError, useCarga } from '../../components/carga'

type ClaveUmbral = Exclude<keyof Parametros, 'metodoConsolidacion'>

interface CampoUmbral {
  clave: ClaveUmbral
  titulo: string
  ayuda: string
  min: number
  max: number
  sufijo?: string
}

// Ranges are the ones of docs/api-contract.md (A1); the server validates them too.
const CAMPOS: CampoUmbral[] = [
  {
    clave: 'umbralFoda',
    titulo: 'Umbral FODA',
    ayuda: 'Valor U (1 a 4): una PM mayor o igual a U es fortaleza u oportunidad',
    min: 1,
    max: 4,
  },
  {
    clave: 'umbralDesacuerdo',
    titulo: 'Desviación entre jurados',
    ayuda: 'Umbral de desviación para marcar jurados en desacuerdo',
    min: 0,
    max: 100,
  },
  {
    clave: 'umbralEmpateTecnico',
    titulo: 'Empate técnico',
    ayuda: 'Diferencia máxima de métrica final para considerar un empate',
    min: 0,
    max: 100,
  },
  {
    clave: 'umbralMetricaAlta',
    titulo: 'Métrica alta',
    ayuda: 'Valor desde el cual la métrica final se considera alta',
    min: 0,
    max: 100,
  },
  {
    clave: 'umbralFactorDiscutido',
    titulo: 'Factor discutido',
    ayuda: 'Rango entre jurados desde el cual un factor se marca como discutido (0 a 3)',
    min: 0,
    max: 3,
  },
  {
    clave: 'umbralDatosInciertos',
    titulo: 'Datos inciertos',
    ayuda: 'Porcentaje de respuestas “Desconozco” que marca datos inciertos',
    min: 0,
    max: 100,
    sufijo: '%',
  },
]

const METODOS: { valor: Metodo; etiqueta: string }[] = [
  { valor: 'mediana', etiqueta: 'Mediana' },
  { valor: 'promedio', etiqueta: 'Promedio' },
]

/** Returns the parameters typed in the form, or the first validation message. */
function leerFormulario(
  texto: Record<ClaveUmbral, string>,
  metodo: Metodo,
): { parametros: Parametros } | { error: string } {
  const valores: Partial<Record<ClaveUmbral, number>> = {}
  for (const campo of CAMPOS) {
    const valor = texto[campo.clave].trim() === '' ? NaN : Number(texto[campo.clave])
    if (!Number.isFinite(valor) || valor < campo.min || valor > campo.max) {
      return { error: `${campo.titulo}: ingresa un valor entre ${campo.min} y ${campo.max}` }
    }
    valores[campo.clave] = valor
  }
  return { parametros: { ...(valores as Record<ClaveUmbral, number>), metodoConsolidacion: metodo } }
}

function aTexto(parametros: Parametros): Record<ClaveUmbral, string> {
  return Object.fromEntries(CAMPOS.map(({ clave }) => [clave, String(parametros[clave])])) as Record<
    ClaveUmbral,
    string
  >
}

export function ParametrosTab() {
  const { datos, error, cargando } = useCarga(obtenerParametros)
  if (!datos) return <EstadoCarga cargando={cargando} error={error} />
  return <FormularioParametros inicial={datos} />
}

function FormularioParametros({ inicial }: { inicial: Parametros }) {
  const [texto, setTexto] = useState(() => aTexto(inicial))
  const [metodo, setMetodo] = useState<Metodo>(inicial.metodoConsolidacion)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const lectura = leerFormulario(texto, metodo)
    if ('error' in lectura) {
      setAviso({ tipo: 'error', texto: lectura.error })
      return
    }
    setAviso(null)
    setEnviando(true)
    try {
      const guardados = await guardarParametros(lectura.parametros)
      setTexto(aTexto(guardados))
      setMetodo(guardados.metodoConsolidacion)
      setAviso({ tipo: 'ok', texto: 'Parámetros guardados' })
    } catch (failure) {
      setAviso(avisoDeError(failure))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={guardar} noValidate>
      <AvisoMensaje aviso={aviso} />
      <div className="rounded-2xl bg-white px-6 shadow-sm">
        {CAMPOS.map((campo) => (
          <div
            key={campo.clave}
            className="flex items-center justify-between gap-6 border-b border-slate-100 py-4"
          >
            <div>
              <label htmlFor={campo.clave} className="block text-sm font-semibold text-slate-900">
                {campo.titulo}
              </label>
              <p id={`${campo.clave}-ayuda`} className="text-xs text-slate-500">
                {campo.ayuda}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={campo.clave}
                type="number"
                step="any"
                min={campo.min}
                max={campo.max}
                value={texto[campo.clave]}
                aria-describedby={`${campo.clave}-ayuda`}
                onChange={(event) => setTexto({ ...texto, [campo.clave]: event.target.value })}
                className={`${campoClass} w-24 text-right`}
              />
              {campo.sufijo && <span className="text-sm text-slate-500">{campo.sufijo}</span>}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-6 py-4">
          <div>
            <p id="metodo-titulo" className="text-sm font-semibold text-slate-900">
              Método de consolidación
            </p>
            <p className="text-xs text-slate-500">
              Método por defecto para consolidar las calificaciones de los jurados
            </p>
          </div>
          <div role="radiogroup" aria-labelledby="metodo-titulo" className="flex rounded-lg bg-slate-100 p-1">
            {METODOS.map(({ valor, etiqueta }) => (
              <label
                key={valor}
                className={`cursor-pointer rounded-md px-4 py-1.5 text-sm has-focus-visible:outline-2 has-focus-visible:outline-brand-600 ${
                  metodo === valor ? 'bg-white font-semibold text-brand-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="metodoConsolidacion"
                  value={valor}
                  checked={metodo === valor}
                  onChange={() => setMetodo(valor)}
                  className="sr-only"
                />
                {etiqueta}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={enviando} className={botonClass}>
          Guardar cambios
        </button>
      </div>
    </form>
  )
}
