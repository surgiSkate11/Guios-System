import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { NuevoSoftware } from '../../api/proyectos'
import { botonClass, campoClass } from '../../components/ui'
import { detalleSoftware } from './formato'

interface SoftwareFormProps {
  ocupado?: boolean
  /** Resolves true when the software was added, which clears the form. */
  onAgregar: (software: NuevoSoftware) => Promise<boolean> | boolean
}

/** Name, version and license of a candidate software; empty optional fields are not sent. */
export function SoftwareForm({ ocupado = false, onAgregar }: SoftwareFormProps) {
  const [nombre, setNombre] = useState('')
  const [version, setVersion] = useState('')
  const [licencia, setLicencia] = useState('')

  async function enviar(event: FormEvent) {
    event.preventDefault()
    const software: NuevoSoftware = { nombre: nombre.trim() }
    if (version.trim() !== '') software.version = version.trim()
    if (licencia.trim() !== '') software.licencia = licencia.trim()
    if (await onAgregar(software)) {
      setNombre('')
      setVersion('')
      setLicencia('')
    }
  }

  return (
    <form onSubmit={enviar} className="rounded-xl bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Agregar nuevo software</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Nombre del software
          <input
            className={campoClass}
            value={nombre}
            placeholder="Nombre del software"
            onChange={(event) => setNombre(event.target.value)}
          />
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Versión
          <input
            className={campoClass}
            value={version}
            placeholder="Ej. 1.0"
            onChange={(event) => setVersion(event.target.value)}
          />
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Licencia
          <input
            className={campoClass}
            value={licencia}
            placeholder="Ej. libre"
            onChange={(event) => setLicencia(event.target.value)}
          />
        </label>
        <button type="submit" className={botonClass} disabled={ocupado || nombre.trim() === ''}>
          <Plus aria-hidden className="mr-1 inline size-4" />
          Agregar software
        </button>
      </div>
    </form>
  )
}

interface SoftwareListaProps {
  softwares: { nombre: string; version?: string | null; licencia?: string | null }[]
  /** When given, each item shows a remove button named by this label. */
  etiquetaQuitar?: (nombre: string) => string
  onQuitar?: (indice: number) => void
  ocupado?: boolean
}

export function SoftwareLista({ softwares, etiquetaQuitar, onQuitar, ocupado }: SoftwareListaProps) {
  if (softwares.length === 0) {
    return <p className="text-sm text-slate-500">Este proyecto aún no tiene softwares</p>
  }
  return (
    <ul className="space-y-2">
      {softwares.map((software, indice) => (
        <li
          key={indice}
          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
        >
          <div className="flex items-baseline gap-3">
            <span className="font-semibold text-slate-900">{software.nombre}</span>
            <span className="text-sm text-slate-500">{detalleSoftware(software)}</span>
          </div>
          {onQuitar && etiquetaQuitar && (
            <button
              type="button"
              disabled={ocupado}
              aria-label={etiquetaQuitar(software.nombre)}
              onClick={() => onQuitar(indice)}
              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
