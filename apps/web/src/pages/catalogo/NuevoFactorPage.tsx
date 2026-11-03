import { ArrowLeft, ListPlus, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { crearFactor, obtenerCatalogo, type NuevoFactor } from '../../api/catalogo'
import type { Alcance } from '../../api/consolidacion'
import { avisoDeError, useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { AvisoMensaje, botonClass, campoClass, EstadoCarga, type Aviso } from '../../components/ui'
import { IndicadoresIs } from './IndicadoresIs'
import { calcularIsEnVivo, leerCitas, leerDois } from './is-en-vivo'

interface FilaSubfactor {
  clave: number
  texto: string
  citas: string
  dois: string
}

const etiquetaClass = 'flex flex-col gap-1 text-sm font-medium text-slate-700'

/**
 * New factor with its citations per subfactor (RF-22, HU-22, HU-23): TC, NS, r, IL and IS are
 * recomputed in the browser while typing; the server computes them again on save.
 */
export function NuevoFactorPage() {
  const catalogo = useCarga(obtenerCatalogo)
  const navigate = useNavigate()
  const [idDimension, setIdDimension] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [alcance, setAlcance] = useState<Alcance>('interno')
  const [filas, setFilas] = useState<FilaSubfactor[]>([{ clave: 0, texto: '', citas: '0', dois: '' }])
  const [siguiente, setSiguiente] = useState(1)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)

  if (!catalogo.datos) {
    return (
      <div>
        <PageHeader title="Nuevo factor" subtitle="Factor nuevo del catálogo con su evidencia" icon={ListPlus} />
        <EstadoCarga cargando={catalogo.cargando} error={catalogo.error} />
      </div>
    )
  }

  const { dimensiones, version } = catalogo.datos
  const dimension = idDimension ?? dimensiones[0]?.id ?? 0
  const enVivo = calcularIsEnVivo(
    filas.map((fila) => ({ citas: fila.citas, dois: leerDois(fila.dois) })),
    version,
  )

  const cambiar = (clave: number, cambio: Partial<FilaSubfactor>) =>
    setFilas((actuales) => actuales.map((fila) => (fila.clave === clave ? { ...fila, ...cambio } : fila)))

  function agregarFila() {
    setFilas((actuales) => [...actuales, { clave: siguiente, texto: '', citas: '0', dois: '' }])
    setSiguiente((valor) => valor + 1)
  }

  async function guardar(event: FormEvent) {
    event.preventDefault()
    if (nombre.trim() === '') return setAviso({ tipo: 'error', texto: 'Escribe el nombre del factor' })
    if (filas.some((fila) => fila.texto.trim() === '')) {
      return setAviso({ tipo: 'error', texto: 'Cada subfactor necesita un texto' })
    }
    if (filas.some((fila) => leerCitas(fila.citas) === null)) {
      return setAviso({ tipo: 'error', texto: 'Las citas deben ser enteros mayores o iguales a 0' })
    }
    const body: NuevoFactor = {
      idDimension: dimension,
      nombre: nombre.trim(),
      alcanceDefault: alcance,
      subfactores: filas.map((fila) => {
        const dois = leerDois(fila.dois)
        const subfactor = { texto: fila.texto.trim(), citas: leerCitas(fila.citas)! }
        return dois.length > 0 ? { ...subfactor, dois } : subfactor
      }),
    }
    setAviso(null)
    setOcupado(true)
    try {
      const estimacion = await crearFactor(body)
      navigate(`/admin/catalogo/estimaciones/${estimacion.id}`)
    } catch (failure) {
      setAviso(avisoDeError(failure))
      setOcupado(false)
    }
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
      <PageHeader title="Nuevo factor" subtitle="Factor nuevo del catálogo con su evidencia" icon={ListPlus} />
      <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Un factor nuevo exige evidencia 2020-2025 y se marca como no validado. Se crea inactivo hasta
        que apruebes su IS.
      </p>
      <AvisoMensaje aviso={aviso} />
      <form onSubmit={guardar} noValidate className="space-y-5">
        <section className="grid grid-cols-3 gap-4 rounded-2xl bg-white p-5">
          <label className={etiquetaClass}>
            Dimensión
            <select
              className={campoClass}
              value={dimension}
              onChange={(event) => setIdDimension(Number(event.target.value))}
            >
              {dimensiones.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className={etiquetaClass}>
            Nombre del factor
            <input className={campoClass} value={nombre} onChange={(event) => setNombre(event.target.value)} />
          </label>
          <label className={etiquetaClass}>
            Alcance por defecto
            <select
              className={campoClass}
              value={alcance}
              onChange={(event) => setAlcance(event.target.value as Alcance)}
            >
              <option value="interno">Interno</option>
              <option value="externo">Externo</option>
            </select>
          </label>
        </section>

        <section className="rounded-2xl bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Subfactores y citas</h2>
          <ul className="space-y-3">
            {filas.map((fila, indice) => {
              const numero = indice + 1
              return (
                <li key={fila.clave} className="grid grid-cols-[2fr_7rem_2fr_auto] items-end gap-3">
                  <label className={etiquetaClass}>
                    {`Subfactor ${numero}`}
                    <input
                      className={campoClass}
                      value={fila.texto}
                      onChange={(event) => cambiar(fila.clave, { texto: event.target.value })}
                    />
                  </label>
                  <label className={etiquetaClass}>
                    <span>
                      Citas<span className="sr-only">{` del subfactor ${numero}`}</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className={campoClass}
                      value={fila.citas}
                      onChange={(event) => cambiar(fila.clave, { citas: event.target.value })}
                    />
                  </label>
                  <label className={etiquetaClass}>
                    <span>
                      DOI<span className="sr-only">{` del subfactor ${numero}`}</span>
                    </span>
                    <input
                      className={campoClass}
                      value={fila.dois}
                      placeholder="10.1000/abc, 10.1000/def"
                      onChange={(event) => cambiar(fila.clave, { dois: event.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Quitar subfactor ${numero}`}
                    disabled={filas.length === 1}
                    onClick={() => setFilas((actuales) => actuales.filter((item) => item.clave !== fila.clave))}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={agregarFila}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            <Plus aria-hidden className="size-4" />
            Agregar subfactor
          </button>
        </section>

        <IndicadoresIs datos={enVivo} cortes={version} />

        <div className="flex justify-end">
          <button type="submit" className={botonClass} disabled={ocupado}>
            Guardar factor
          </button>
        </div>
      </form>
    </div>
  )
}
