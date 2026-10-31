import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../auth/form'
import type { Aviso } from './ui'

/** Error feedback with the message sent by the server. */
export function avisoDeError(error: unknown): Aviso {
  return { tipo: 'error', texto: errorMessage(error) }
}

/** Loads data once on mount; `actualizar` edits the loaded data after a successful write. */
export function useCarga<T>(cargar: () => Promise<T>) {
  const [estado, setEstado] = useState<{ datos: T | null; error: string | null }>({
    datos: null,
    error: null,
  })

  useEffect(() => {
    let activo = true
    cargar().then(
      (datos) => {
        if (activo) setEstado({ datos, error: null })
      },
      (error: unknown) => {
        if (activo) setEstado({ datos: null, error: errorMessage(error) })
      },
    )
    return () => {
      activo = false
    }
  }, [cargar])

  const actualizar = useCallback((cambio: (datos: T) => T) => {
    setEstado((actual) => (actual.datos === null ? actual : { ...actual, datos: cambio(actual.datos) }))
  }, [])

  return { ...estado, cargando: estado.datos === null && estado.error === null, actualizar }
}
