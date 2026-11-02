import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import {
  agregarJurado,
  buscarUsuarioPorEmail,
  finalizarJurado,
  quitarJurado,
  type ProyectoResumen,
  type UsuarioResumen,
} from '../../api/proyectos'
import { useAuth } from '../../auth/auth-context'
import { useAccion } from '../../components/carga'
import { AvisoMensaje, botonClass, campoClass } from '../../components/ui'
import { EstadoJuradoEtiqueta } from './Etiquetas'

interface JuradosPanelProps {
  proyecto: ProyectoResumen
  /** Only the project coordinator edits judges, and never on a closed project. */
  puedeEditar: boolean
  onCambio: (proyecto: ProyectoResumen) => void
}

const accionClass = 'font-medium hover:underline disabled:opacity-50'

const SIN_USUARIO = 'No existe un usuario activo con ese correo'

/**
 * Judges of a project: list, invite by exact e-mail (search, then invite), finish and remove.
 * There is no user list on purpose: it would expose users of other organizations (RNF-08).
 */
export function JuradosPanel({ proyecto, puedeEditar, onCambio }: JuradosPanelProps) {
  const { usuario } = useAuth()
  const { aviso, ocupado, ejecutar } = useAccion()
  const [email, setEmail] = useState('')
  const [encontrado, setEncontrado] = useState<UsuarioResumen | null>(null)
  const yoSoyJurado = proyecto.jurados.some((jurado) => jurado.idUsuario === usuario?.id)

  /** Publishes the updated project and returns the success message for the feedback. */
  function aplicar(actualizado: ProyectoResumen, mensaje: string) {
    onCambio(actualizado)
    return mensaje
  }

  async function buscar(event: FormEvent) {
    event.preventDefault()
    setEncontrado(null)
    await ejecutar(async () => {
      try {
        setEncontrado(await buscarUsuarioPorEmail(email.trim()))
        return 'Usuario encontrado'
      } catch (error) {
        throw error instanceof ApiError && error.status === 404 ? new ApiError(404, SIN_USUARIO) : error
      }
    })
  }

  async function invitar(candidato: UsuarioResumen) {
    const agregado = await ejecutar(async () =>
      aplicar(await agregarJurado(proyecto.id, candidato.id), 'Jurado agregado'),
    )
    if (agregado) {
      setEmail('')
      setEncontrado(null)
    }
  }

  return (
    <div>
      <AvisoMensaje aviso={aviso} />
      {proyecto.jurados.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">Este proyecto aún no tiene jurados</p>
      ) : (
        <table className="mb-4 w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Estado</th>
              {puedeEditar && <th className="px-3 py-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {proyecto.jurados.map((jurado) => (
              <tr key={jurado.idUsuario} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{jurado.nombre}</td>
                <td className="px-3 py-2 text-slate-600">{jurado.email}</td>
                <td className="px-3 py-2">
                  <EstadoJuradoEtiqueta estado={jurado.estado} />
                </td>
                {puedeEditar && (
                  <td className="space-x-3 px-3 py-2">
                    {jurado.estado === 'activo' && (
                      <button
                        type="button"
                        disabled={ocupado}
                        aria-label={`Finalizar jurado ${jurado.nombre}`}
                        className={`${accionClass} text-brand-700`}
                        onClick={() =>
                          ejecutar(async () =>
                            aplicar(
                              await finalizarJurado(proyecto.id, jurado.idUsuario),
                              'Jurado finalizado',
                            ),
                          )
                        }
                      >
                        Finalizar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={ocupado}
                      aria-label={`Quitar jurado ${jurado.nombre}`}
                      className={`${accionClass} text-red-600`}
                      onClick={() =>
                        ejecutar(async () =>
                          aplicar(await quitarJurado(proyecto.id, jurado.idUsuario), 'Jurado quitado'),
                        )
                      }
                    >
                      Quitar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {puedeEditar && (
        <form onSubmit={buscar} className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
            Correo del jurado
            <input
              type="email"
              className={campoClass}
              value={email}
              placeholder="correo@organizacion.com"
              onChange={(event) => {
                setEmail(event.target.value)
                setEncontrado(null)
              }}
            />
          </label>
          <button type="submit" className={botonClass} disabled={ocupado || email.trim() === ''}>
            Buscar
          </button>
          {encontrado && (
            <span className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
              {encontrado.nombre} ({encontrado.email})
              <button
                type="button"
                className={botonClass}
                disabled={ocupado}
                onClick={() => void invitar(encontrado)}
              >
                <UserPlus aria-hidden className="mr-1 inline size-4" />
                Invitar
              </button>
            </span>
          )}
          {usuario && !yoSoyJurado && (
            <button
              type="button"
              disabled={ocupado}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() =>
                ejecutar(async () =>
                  aplicar(await agregarJurado(proyecto.id, usuario.id), 'Te agregaste como jurado'),
                )
              }
            >
              Agregarme como jurado
            </button>
          )}
        </form>
      )}
    </div>
  )
}
