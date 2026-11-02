import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { errorMessage } from '../pages/auth/form'
import type { Aviso } from './ui'

/** Error feedback with the message sent by the server. */
export function avisoDeError(error: unknown): Aviso {
  return { tipo: 'error', texto: errorMessage(error) }
}

/** Loads data once on mount; `actualizar` edits the loaded data after a successful write. */
export function useCarga<T>(cargar: () => Promise<T>) {
  const [estado, setEstado] = useState<{
    datos: T | null
    error: string | null
    /** HTTP status of the load error, when the API answered one. */
    status: number | null
  }>({ datos: null, error: null, status: null })

  useEffect(() => {
    let activo = true
    cargar().then(
      (datos) => {
        if (activo) setEstado({ datos, error: null, status: null })
      },
      (error: unknown) => {
        if (activo) {
          const status = error instanceof ApiError ? error.status : null
          setEstado({ datos: null, error: errorMessage(error), status })
        }
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

/**
 * Runs a write and keeps its feedback: `accion` resolves with the success message.
 * `ejecutar` resolves true when the write succeeded.
 */
export function useAccion() {
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = useCallback(async (accion: () => Promise<string>): Promise<boolean> => {
    setOcupado(true)
    setAviso(null)
    try {
      setAviso({ tipo: 'ok', texto: await accion() })
      return true
    } catch (error) {
      setAviso(avisoDeError(error))
      return false
    } finally {
      setOcupado(false)
    }
  }, [])

  return { aviso, ocupado, ejecutar, limpiar: () => setAviso(null) }
}
