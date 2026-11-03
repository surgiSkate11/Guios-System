import { ArrowLeft, Check, ClipboardCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  crearProyecto,
  obtenerCatalogoVigente,
  type Metodo,
  type NuevoSoftware,
  type ProyectoResumen,
} from '../../api/proyectos'
import { obtenerParametros } from '../../api/admin'
import { avisoDeError, useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { AvisoMensaje, botonClass, campoClass, EstadoCarga, type Aviso } from '../../components/ui'
import { useProyectos } from '../../proyectos/proyectos-context'
import { ETIQUETA_METODO } from './formato'
import { JuradosPanel } from './JuradosPanel'
import { SoftwareForm, SoftwareLista } from './SoftwareForm'

type Paso = 'datos' | 'softwares' | 'jurados'

const PASOS: { clave: Paso; etiqueta: string }[] = [
  { clave: 'datos', etiqueta: 'Datos' },
  { clave: 'softwares', etiqueta: 'Softwares candidatos' },
  { clave: 'jurados', etiqueta: 'Jurados' },
]

const secundarioClass =
  'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50'

function Pasos({ actual }: { actual: Paso }) {
  const indiceActual = PASOS.findIndex((paso) => paso.clave === actual)
  return (
    <ol aria-label="Pasos" className="mb-6 flex items-center gap-4">
      {PASOS.map((paso, indice) => (
        <li
          key={paso.clave}
          aria-current={indice === indiceActual ? 'step' : undefined}
          className={`flex items-center gap-2 text-sm ${indice === indiceActual ? 'font-semibold text-slate-900' : 'text-slate-500'}`}
        >
          <span
            aria-hidden
            className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${
              indice < indiceActual
                ? 'bg-brand-600 text-white'
                : indice === indiceActual
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-600'
            }`}
          >
            {indice < indiceActual ? <Check className="size-4" /> : indice + 1}
          </span>
          {paso.etiqueta}
        </li>
      ))}
    </ol>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{titulo}</h2>
      {children}
    </section>
  )
}

interface Datos {
  nombre: string
  fechaInicio: string
  fechaFin: string
  metodoConsolidacion: Metodo
  idDimensiones: number[]
}

const DATOS_INICIALES: Datos = {
  nombre: '',
  fechaInicio: '',
  fechaFin: '',
  metodoConsolidacion: 'mediana',
  idDimensiones: [],
}

function alternar(lista: number[], id: number): number[] {
  return lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]
}

/** Three-step form (RF-02, RF-03): data, candidate softwares, judges of the created project. */
export function NuevoProyectoPage() {
  const { registrar } = useProyectos()
  const catalogo = useCarga(obtenerCatalogoVigente)
  const [paso, setPaso] = useState<Paso>('datos')
  const [datos, setDatos] = useState<Datos>(DATOS_INICIALES)
  const [metodoTocado, setMetodoTocado] = useState(false)
  const parametros = useCarga(obtenerParametros)
  // The system default method (A1, readable by any user) applies until the user picks one.
  const metodo =
    metodoTocado || !parametros.datos ? datos.metodoConsolidacion : parametros.datos.metodoConsolidacion
  const [softwares, setSoftwares] = useState<NuevoSoftware[]>([])
  const [creado, setCreado] = useState<ProyectoResumen | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)

  const dimensiones = catalogo.datos?.dimensiones ?? []
  const error = (texto: string) => setAviso({ tipo: 'error', texto })

  function validarDatos(event: FormEvent) {
    event.preventDefault()
    if (datos.nombre.trim() === '') return error('Escribe el nombre del proyecto')
    if (datos.fechaInicio === '') return error('Indica la fecha de inicio')
    if (datos.idDimensiones.length === 0) return error('Elige al menos una dimensión')
    setAviso(null)
    setPaso('softwares')
  }

  async function crear() {
    if (softwares.length === 0) return error('Agrega al menos un software')
    setOcupado(true)
    setAviso(null)
    try {
      const proyecto = await crearProyecto({
        nombre: datos.nombre.trim(),
        fechaInicio: datos.fechaInicio,
        ...(datos.fechaFin !== '' && { fechaFin: datos.fechaFin }),
        metodoConsolidacion: metodo,
        // Keep the catalog order, not the order of the clicks.
        idDimensiones: dimensiones
          .filter((dimension) => datos.idDimensiones.includes(dimension.id))
          .map((dimension) => dimension.id),
        softwares,
      })
      registrar(proyecto)
      setCreado(proyecto)
      setAviso({ tipo: 'ok', texto: 'Proyecto creado. Invita a los jurados que lo evaluarán.' })
      setPaso('jurados')
    } catch (fallo) {
      setAviso(avisoDeError(fallo))
    } finally {
      setOcupado(false)
    }
  }

  function agregarSoftwareLocal(software: NuevoSoftware): boolean {
    setSoftwares((lista) => [...lista, software])
    setAviso(null)
    return true
  }

  return (
    <>
      <Link
        to="/evaluaciones"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Volver a evaluaciones
      </Link>
      <PageHeader
        title="Nuevo proyecto de evaluación"
        subtitle="Crea una evaluación en tres pasos"
        icon={ClipboardCheck}
      />
      <Pasos actual={paso} />
      <AvisoMensaje aviso={aviso} />

      {paso === 'datos' && (
        <Tarjeta titulo="Datos del proyecto">
          <form onSubmit={validarDatos} noValidate className="grid max-w-2xl gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nombre del proyecto
              <input
                className={campoClass}
                value={datos.nombre}
                onChange={(event) => setDatos({ ...datos, nombre: event.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Fecha de inicio
                <input
                  type="date"
                  className={campoClass}
                  value={datos.fechaInicio}
                  onChange={(event) => setDatos({ ...datos, fechaInicio: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Fecha de fin (opcional)
                <input
                  type="date"
                  className={campoClass}
                  value={datos.fechaFin}
                  onChange={(event) => setDatos({ ...datos, fechaFin: event.target.value })}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Método de consolidación
              <select
                className={campoClass}
                value={metodo}
                onChange={(event) => {
                  setMetodoTocado(true)
                  setDatos({ ...datos, metodoConsolidacion: event.target.value as Metodo })
                }}
              >
                {(Object.keys(ETIQUETA_METODO) as Metodo[]).map((metodo) => (
                  <option key={metodo} value={metodo}>
                    {ETIQUETA_METODO[metodo]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-slate-700">Dimensiones a evaluar</legend>
              <EstadoCarga cargando={catalogo.cargando} error={catalogo.error} />
              {dimensiones.map((dimension) => (
                <label key={dimension.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={datos.idDimensiones.includes(dimension.id)}
                    onChange={() =>
                      setDatos({ ...datos, idDimensiones: alternar(datos.idDimensiones, dimension.id) })
                    }
                  />
                  {dimension.nombre}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-3">
              <Link to="/evaluaciones" className={secundarioClass}>
                Cancelar
              </Link>
              <button type="submit" className={botonClass}>
                Siguiente
              </button>
            </div>
          </form>
        </Tarjeta>
      )}

      {paso === 'softwares' && (
        <Tarjeta titulo="Softwares candidatos">
          <p className="mb-4 text-sm text-slate-500">Agrega los softwares que se compararán</p>
          <div className="mb-4">
            <SoftwareLista
              softwares={softwares}
              ocupado={ocupado}
              etiquetaQuitar={(nombre) => `Quitar ${nombre}`}
              onQuitar={(indice) =>
                setSoftwares((lista) => lista.filter((_, posicion) => posicion !== indice))
              }
            />
          </div>
          <SoftwareForm ocupado={ocupado} onAgregar={agregarSoftwareLocal} />
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              className={secundarioClass}
              disabled={ocupado}
              onClick={() => {
                setAviso(null)
                setPaso('datos')
              }}
            >
              Atrás
            </button>
            <div className="flex gap-3">
              <Link to="/evaluaciones" className={secundarioClass}>
                Cancelar
              </Link>
              <button type="button" className={botonClass} disabled={ocupado} onClick={crear}>
                Siguiente
              </button>
            </div>
          </div>
        </Tarjeta>
      )}

      {paso === 'jurados' && creado && (
        <Tarjeta titulo="Jurados">
          <p className="mb-4 text-sm text-slate-500">
            Invita por correo a los jurados, o agrégate si evaluarás tú solo. Cada uno recibe una
            solicitud que debe aceptar.
          </p>
          <JuradosPanel
            proyecto={creado}
            puedeEditar
            onCambio={(actualizado) => {
              setAviso(null)
              setCreado(actualizado)
              registrar(actualizado)
            }}
          />
          <div className="mt-6 flex justify-end">
            <Link to={`/proyectos/${creado.id}`} className={botonClass}>
              Ir al proyecto
            </Link>
          </div>
        </Tarjeta>
      )}
    </>
  )
}
