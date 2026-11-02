import { useCallback, useMemo, type ReactNode } from 'react'
import { listarProyectos, listarSolicitudes, type ProyectoResumen } from '../api/proyectos'
import { useAuth } from '../auth/auth-context'
import { useCarga } from '../components/carga'
import { ProyectosContext, type ProyectosState } from './proyectos-context'

function insertar(lista: ProyectoResumen[], proyecto: ProyectoResumen): ProyectoResumen[] {
  return lista.some((item) => item.id === proyecto.id)
    ? lista.map((item) => (item.id === proyecto.id ? proyecto : item))
    : [proyecto, ...lista]
}

/**
 * Loads the projects and judge requests once per session so the menu, the home page and the
 * lists share them. The administrator sees no projects, so nothing is requested for them.
 */
export function ProyectosProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const sinProyectos = usuario?.rol === 'administrador'
  const cargarProyectos = useCallback(
    () => (sinProyectos ? Promise.resolve([]) : listarProyectos()),
    [sinProyectos],
  )
  const cargarSolicitudes = useCallback(
    () => (sinProyectos ? Promise.resolve([]) : listarSolicitudes()),
    [sinProyectos],
  )
  const proyectos = useCarga<ProyectoResumen[]>(cargarProyectos)
  const solicitudes = useCarga<ProyectoResumen[]>(cargarSolicitudes)
  const { actualizar: actualizarProyectos } = proyectos
  const { actualizar: actualizarSolicitudes } = solicitudes

  const registrar = useCallback(
    (proyecto: ProyectoResumen) => {
      actualizarProyectos((lista) => insertar(lista, proyecto))
      actualizarSolicitudes((lista) =>
        proyecto.miEstadoJurado === 'invitado'
          ? insertar(lista, proyecto)
          : lista.filter((item) => item.id !== proyecto.id),
      )
    },
    [actualizarProyectos, actualizarSolicitudes],
  )

  const quitar = useCallback(
    (id: number) => {
      actualizarProyectos((lista) => lista.filter((item) => item.id !== id))
      actualizarSolicitudes((lista) => lista.filter((item) => item.id !== id))
    },
    [actualizarProyectos, actualizarSolicitudes],
  )

  const value = useMemo<ProyectosState>(
    () => ({
      proyectos: proyectos.datos,
      solicitudes: solicitudes.datos,
      error: proyectos.error,
      errorSolicitudes: solicitudes.error,
      cargando: proyectos.cargando,
      registrar,
      quitar,
    }),
    [proyectos.datos, proyectos.error, proyectos.cargando, solicitudes.datos, solicitudes.error, registrar, quitar],
  )

  return <ProyectosContext value={value}>{children}</ProyectosContext>
}
