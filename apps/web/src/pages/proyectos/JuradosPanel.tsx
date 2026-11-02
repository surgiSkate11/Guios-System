import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  agregarJurado,
  buscarUsuarioPorEmail,
  finalizarJurado,
  quitarJurado,
  type ProyectoResumen,
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

/** Judges of a project: list, invite by e-mail (A3 search + add), finish and remove. */
export function JuradosPanel({ proyecto, puedeEditar, onCambio }: JuradosPanelProps) {
  const { usuario } = useAuth()
  const { aviso, ocupado, ejecutar } = useAccion()
  const [email, setEmail] = useState('')
  const yoSoyJurado = proyecto.jurados.some((jurado) => jurado.idUsuario === usuario?.id)

  /** Publishes the updated project and returns the success message for the feedback. */
  function aplicar(actualizado: ProyectoResumen, mensaje: string) {
    onCambio(actualizado)
    return mensaje
  }

  async function invitar(event: FormEvent) {
    event.preventDefault()
    const agregado = await ejecutar(async () => {
      const encontrado = await buscarUsuarioPorEmail(email.trim())
      return aplicar(await agregarJurado(proyecto.id, encontrado.id), 'Jurado agregado')
    })
    if (agregado) setEmail('')
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
        <form onSubmit={invitar} className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
            Correo del jurado
            <input
              type="email"
              className={campoClass}
              value={email}
              placeholder="correo@organizacion.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" className={botonClass} disabled={ocupado || email.trim() === ''}>
            <UserPlus aria-hidden className="mr-1 inline size-4" />
            Agregar jurado
          </button>
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
