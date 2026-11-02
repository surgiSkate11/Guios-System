import { useState } from 'react'
import {
  actualizarUsuario,
  listarOrganizaciones,
  listarUsuarios,
  type Rol,
  type UsuarioAdmin,
} from '../../api/admin'
import { useAuth } from '../../auth/auth-context'
import {
  AvisoMensaje,
  botonClass,
  campoClass,
  EstadoCarga,
  type Aviso,
} from '../../components/ui'
import { avisoDeError, useCarga } from '../../components/carga'

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'invitado', etiqueta: 'Invitado' },
  { valor: 'coordinador', etiqueta: 'Coordinador' },
  { valor: 'administrador', etiqueta: 'Administrador' },
]

export function UsuariosTab() {
  const usuarios = useCarga(listarUsuarios)
  const organizaciones = useCarga(listarOrganizaciones)
  const [aviso, setAviso] = useState<Aviso>(null)

  if (!usuarios.datos || !organizaciones.datos) {
    return (
      <EstadoCarga
        cargando={usuarios.cargando || organizaciones.cargando}
        error={usuarios.error ?? organizaciones.error}
      />
    )
  }

  const activas = organizaciones.datos.filter((organizacion) => organizacion.activo)

  function reemplazar(actualizado: UsuarioAdmin) {
    usuarios.actualizar((lista) => lista.map((item) => (item.id === actualizado.id ? actualizado : item)))
    setAviso({ tipo: 'ok', texto: 'Usuario actualizado' })
  }

  return (
    <>
      <AvisoMensaje aviso={aviso} />
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Nombre</th>
              <th scope="col" className="px-4 py-3 font-semibold">Correo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Rol</th>
              <th scope="col" className="px-4 py-3 font-semibold">Organización</th>
              <th scope="col" className="px-4 py-3 font-semibold">Activo</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.datos.map((usuario) => (
              <FilaUsuario
                key={usuario.id}
                usuario={usuario}
                organizaciones={activas}
                onGuardado={reemplazar}
                onError={(failure) => setAviso(avisoDeError(failure))}
                onIntento={() => setAviso(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

interface FilaUsuarioProps {
  usuario: UsuarioAdmin
  /** Active organizations; the current one is added when it is inactive. */
  organizaciones: { id: number; nombre: string }[]
  onGuardado: (usuario: UsuarioAdmin) => void
  onError: (error: unknown) => void
  onIntento: () => void
}

function FilaUsuario({ usuario, organizaciones, onGuardado, onError, onIntento }: FilaUsuarioProps) {
  const { usuario: sesion } = useAuth()
  const [rol, setRol] = useState<Rol>(usuario.rol)
  const [idOrganizacion, setIdOrganizacion] = useState<number | null>(usuario.idOrganizacion)
  const [activo, setActivo] = useState(usuario.activo)
  const [enviando, setEnviando] = useState(false)
  // The server forbids it (409); the interface does not offer it.
  const esMiCuenta = sesion?.id === usuario.id

  const opciones =
    usuario.organizacion && !organizaciones.some((item) => item.id === usuario.organizacion!.id)
      ? [...organizaciones, usuario.organizacion]
      : organizaciones

  const cambios = {
    ...(rol !== usuario.rol && { rol }),
    ...(idOrganizacion !== usuario.idOrganizacion && { idOrganizacion }),
    ...(activo !== usuario.activo && { activo }),
  }
  const hayCambios = Object.keys(cambios).length > 0

  async function guardar() {
    onIntento()
    setEnviando(true)
    try {
      onGuardado(await actualizarUsuario(usuario.id, cambios))
    } catch (failure) {
      onError(failure)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-medium text-slate-900">{usuario.nombre}</td>
      <td className="px-4 py-3 text-slate-600">{usuario.email}</td>
      <td className="px-4 py-3">
        <select
          aria-label={`Rol de ${usuario.nombre}`}
          value={rol}
          disabled={esMiCuenta}
          onChange={(event) => setRol(event.target.value as Rol)}
          className={campoClass}
        >
          {ROLES.map(({ valor, etiqueta }) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          aria-label={`Organización de ${usuario.nombre}`}
          value={idOrganizacion === null ? '' : String(idOrganizacion)}
          onChange={(event) =>
            setIdOrganizacion(event.target.value === '' ? null : Number(event.target.value))
          }
          className={campoClass}
        >
          <option value="">Sin organización</option>
          {opciones.map((organizacion) => (
            <option key={organizacion.id} value={organizacion.id}>
              {organizacion.nombre}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          aria-label={`Activo: ${usuario.nombre}`}
          checked={activo}
          disabled={esMiCuenta}
          onChange={(event) => setActivo(event.target.checked)}
          className="size-4 accent-brand-600"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          aria-label={`Guardar ${usuario.nombre}`}
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
