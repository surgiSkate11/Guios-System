import { useState, type FormEvent } from 'react'
import {
  actualizarOrganizacion,
  crearOrganizacion,
  listarOrganizaciones,
  type Organizacion,
  type Sector,
} from '../../api/admin'
import {
  AvisoMensaje,
  botonClass,
  campoClass,
  EstadoCarga,
  type Aviso,
} from './ui'
import { avisoDeError, useCarga } from './carga'

const SECTORES: { valor: Sector; etiqueta: string }[] = [
  { valor: 'publico', etiqueta: 'Público' },
  { valor: 'privado', etiqueta: 'Privado' },
  { valor: 'independiente', etiqueta: 'Independiente' },
]

export function OrganizacionesTab() {
  const { datos, error, cargando, actualizar } = useCarga(listarOrganizaciones)
  const [aviso, setAviso] = useState<Aviso>(null)

  if (!datos) return <EstadoCarga cargando={cargando} error={error} />

  return (
    <>
      <AvisoMensaje aviso={aviso} />
      <FormularioNueva
        onCreada={(creada) => {
          actualizar((lista) => [...lista, creada].sort((a, b) => a.nombre.localeCompare(b.nombre)))
          setAviso({ tipo: 'ok', texto: 'Organización creada' })
        }}
        onError={setAviso}
      />
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Nombre</th>
              <th scope="col" className="px-4 py-3 font-semibold">Sector</th>
              <th scope="col" className="px-4 py-3 font-semibold">Activa</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {datos.map((organizacion) => (
              <FilaOrganizacion
                key={organizacion.id}
                organizacion={organizacion}
                onGuardada={(guardada) => {
                  actualizar((lista) =>
                    lista.map((item) => (item.id === guardada.id ? guardada : item)),
                  )
                  setAviso({ tipo: 'ok', texto: 'Organización actualizada' })
                }}
                onError={setAviso}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function FormularioNueva({
  onCreada,
  onError,
}: {
  onCreada: (organizacion: Organizacion) => void
  onError: (aviso: Aviso) => void
}) {
  const [nombre, setNombre] = useState('')
  const [sector, setSector] = useState<Sector | ''>('')
  const [enviando, setEnviando] = useState(false)

  async function crear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (nombre.trim() === '' || sector === '') {
      onError({ tipo: 'error', texto: 'Indica el nombre y el sector de la organización' })
      return
    }
    setEnviando(true)
    try {
      onCreada(await crearOrganizacion({ nombre: nombre.trim(), sector }))
      setNombre('')
      setSector('')
    } catch (failure) {
      onError(avisoDeError(failure))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="nueva-nombre" className="mb-1 block text-xs font-semibold text-slate-800">
          Nombre de la nueva organización
        </label>
        <input
          id="nueva-nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className={`${campoClass} w-72`}
        />
      </div>
      <div>
        <label htmlFor="nueva-sector" className="mb-1 block text-xs font-semibold text-slate-800">
          Sector de la nueva organización
        </label>
        <select
          id="nueva-sector"
          value={sector}
          onChange={(event) => setSector(event.target.value as Sector | '')}
          className={campoClass}
        >
          <option value="">Selecciona un sector</option>
          {SECTORES.map(({ valor, etiqueta }) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={enviando} className={botonClass}>
        Crear organización
      </button>
    </form>
  )
}

interface FilaOrganizacionProps {
  organizacion: Organizacion
  onGuardada: (organizacion: Organizacion) => void
  onError: (aviso: Aviso) => void
}

function FilaOrganizacion({ organizacion, onGuardada, onError }: FilaOrganizacionProps) {
  const [nombre, setNombre] = useState(organizacion.nombre)
  const [sector, setSector] = useState<Sector>(organizacion.sector)
  const [activo, setActivo] = useState(organizacion.activo)
  const [enviando, setEnviando] = useState(false)

  const cambios = {
    ...(nombre.trim() !== organizacion.nombre && { nombre: nombre.trim() }),
    ...(sector !== organizacion.sector && { sector }),
    ...(activo !== organizacion.activo && { activo }),
  }
  const hayCambios = Object.keys(cambios).length > 0

  async function guardar() {
    if (nombre.trim() === '') {
      onError({ tipo: 'error', texto: 'El nombre de la organización no puede estar vacío' })
      return
    }
    setEnviando(true)
    try {
      onGuardada(await actualizarOrganizacion(organizacion.id, cambios))
    } catch (failure) {
      onError(avisoDeError(failure))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <input
          aria-label={`Nombre de ${organizacion.nombre}`}
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className={`${campoClass} w-72`}
        />
      </td>
      <td className="px-4 py-3">
        <select
          aria-label={`Sector de ${organizacion.nombre}`}
          value={sector}
          onChange={(event) => setSector(event.target.value as Sector)}
          className={campoClass}
        >
          {SECTORES.map(({ valor, etiqueta }) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          aria-label={`Activa: ${organizacion.nombre}`}
          checked={activo}
          onChange={(event) => setActivo(event.target.checked)}
          className="size-4 accent-brand-600"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          aria-label={`Guardar ${organizacion.nombre}`}
          disabled={!hayCambios || enviando}
          onClick={guardar}
          className={botonClass}
        >
          Guardar
        </button>
      </td>
    </tr>
  )
}
