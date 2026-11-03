import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import {
  agregarSoftware,
  cambiarEstadoProyecto,
  obtenerProyecto,
  quitarSoftware,
  type NuevoSoftware,
  type ProyectoResumen,
} from '../../api/proyectos'
import { useAccion, useCarga } from '../../components/carga'
import { PageHeader } from '../../components/PageHeader'
import { AvisoMensaje, botonClass, EstadoCarga } from '../../components/ui'
import { useProyectos } from '../../proyectos/proyectos-context'
import { EstadoProyectoEtiqueta } from './Etiquetas'
import { ETIQUETA_ESTADO_JURADO, ETIQUETA_METODO, formatearFecha } from './formato'
import { JuradosPanel } from './JuradosPanel'
import { SoftwareForm, SoftwareLista } from './SoftwareForm'

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{titulo}</h2>
      {children}
    </section>
  )
}

function Dato({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{nombre}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{valor}</dd>
    </div>
  )
}

interface DetalleProps {
  proyecto: ProyectoResumen
  onCambio: (proyecto: ProyectoResumen) => void
}

function Softwares({ proyecto, onCambio }: DetalleProps) {
  const { aviso, ocupado, ejecutar } = useAccion()
  const esCoordinador = proyecto.miRol === 'coordinador'
  const abierto = proyecto.estado !== 'cerrado'

  const agregar = (software: NuevoSoftware) =>
    ejecutar(async () => {
      onCambio(await agregarSoftware(proyecto.id, software))
      return 'Software agregado'
    })

  const quitar = (indice: number) =>
    ejecutar(async () => {
      onCambio(await quitarSoftware(proyecto.id, proyecto.softwares[indice]!.id))
      return 'Software quitado'
    })

  return (
    <Seccion titulo="Softwares candidatos">
      <AvisoMensaje aviso={aviso} />
      <div className="mb-4">
        <SoftwareLista
          softwares={proyecto.softwares}
          ocupado={ocupado}
          // A software can only be removed while the project is a draft (A3).
          onQuitar={esCoordinador && proyecto.estado === 'borrador' ? quitar : undefined}
          etiquetaQuitar={(nombre) => `Quitar software ${nombre}`}
        />
      </div>
      {esCoordinador && abierto && <SoftwareForm ocupado={ocupado} onAgregar={agregar} />}
    </Seccion>
  )
}

function Acciones({ proyecto, onCambio }: DetalleProps) {
  const { aviso, ocupado, ejecutar } = useAccion()
  if (proyecto.miRol !== 'coordinador' || proyecto.estado === 'cerrado') return null

  const cambiar = (estado: 'en_curso' | 'cerrado', mensaje: string) =>
    ejecutar(async () => {
      onCambio(await cambiarEstadoProyecto(proyecto.id, estado))
      return mensaje
    })

  return (
    <div className="mb-6">
      <AvisoMensaje aviso={aviso} />
      {proyecto.estado === 'borrador' ? (
        <button
          type="button"
          className={botonClass}
          disabled={ocupado}
          onClick={() => cambiar('en_curso', 'La evaluación está en curso')}
        >
          Iniciar evaluación
        </button>
      ) : (
        <button
          type="button"
          className={botonClass}
          disabled={ocupado}
          onClick={() => cambiar('cerrado', 'Proyecto cerrado')}
        >
          Cerrar proyecto
        </button>
      )}
    </div>
  )
}

function Detalle({ id }: { id: number }) {
  const { registrar } = useProyectos()
  const cargar = useCallback(() => obtenerProyecto(id), [id])
  const { datos: proyecto, error, cargando, actualizar } = useCarga(cargar)

  const alCambiar = useCallback(
    (actualizado: ProyectoResumen) => {
      actualizar(() => actualizado)
      registrar(actualizado)
    },
    [actualizar, registrar],
  )

  if (!proyecto) {
    return (
      <>
        <PageHeader title="Proyecto" subtitle="Detalle del proyecto" icon={ClipboardCheck} />
        <EstadoCarga cargando={cargando} error={error} />
      </>
    )
  }

  const esCoordinador = proyecto.miRol === 'coordinador'
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
        title={proyecto.nombre}
        subtitle={`Coordinador: ${proyecto.coordinador.nombre}`}
        icon={ClipboardCheck}
        actions={<EstadoProyectoEtiqueta estado={proyecto.estado} />}
      />
      {proyecto.miEstadoJurado && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white px-6 py-4">
          <p className="text-sm font-medium text-slate-800">
            Tu estado como jurado: {ETIQUETA_ESTADO_JURADO[proyecto.miEstadoJurado]}
          </p>
          {proyecto.miEstadoJurado === 'activo' && proyecto.estado === 'en_curso' && (
            <Link to={`/proyectos/${proyecto.id}/importancia`} className={botonClass}>
              Calificar factores
            </Link>
          )}
        </div>
      )}
      <Acciones proyecto={proyecto} onCambio={alCambiar} />
      <Seccion titulo="Datos del proyecto">
        <dl className="grid grid-cols-3 gap-4">
          <Dato nombre="Organización" valor={proyecto.organizacion.nombre} />
          <Dato nombre="Método de consolidación" valor={ETIQUETA_METODO[proyecto.metodoConsolidacion]} />
          <Dato nombre="Versión de catálogo" valor={`Versión ${proyecto.versionCatalogo}`} />
          <Dato nombre="Fecha de inicio" valor={formatearFecha(proyecto.fechaInicio)} />
          <Dato
            nombre="Fecha de fin"
            valor={proyecto.fechaFin ? formatearFecha(proyecto.fechaFin) : 'Sin definir'}
          />
          <Dato nombre="Dimensiones" valor={proyecto.dimensiones.map((item) => item.nombre).join(', ')} />
        </dl>
      </Seccion>
      <Softwares proyecto={proyecto} onCambio={alCambiar} />
      <Seccion titulo="Jurados">
        <JuradosPanel
          proyecto={proyecto}
          puedeEditar={esCoordinador && proyecto.estado !== 'cerrado'}
          onCambio={alCambiar}
        />
      </Seccion>
    </>
  )
}

/** Project detail: data, candidate softwares and judges; only the coordinator edits. */
export function ProyectoDetallePage() {
  const { id } = useParams()
  // `key` resets the loaded project when the route moves to another one.
  return <Detalle key={id} id={Number(id)} />
}
