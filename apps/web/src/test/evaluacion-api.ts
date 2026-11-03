import { DESCONOZCO, ponderacionMediaJurado, type Calificacion } from '@guios/calculo'
import type { CalificacionesMias, ImportanciaMia } from '../api/evaluacion'
import type { FakeHandler } from './fake-api'

export const IMPORTANCIAS: ImportanciaMia[] = [
  {
    idProyectoFactor: 501,
    factor: { id: 1, nombre: 'Compatibilidad' },
    dimension: { id: 1, nombre: 'Tecnológica' },
    impSugerida: 3,
    impDecisor: 3,
  },
  {
    idProyectoFactor: 502,
    factor: { id: 2, nombre: 'Soporte' },
    dimension: { id: 2, nombre: 'Organizacional' },
    impSugerida: 2,
    impDecisor: null,
  },
]

/** Ratings of the judge for software 100 (Software A), two relevant factors. */
export function calificacionesBase(idSoftware: number, nombre: string): CalificacionesMias {
  return {
    software: { id: idSoftware, nombre },
    factores: [
      {
        idProyectoFactor: 501,
        factor: { id: 1, nombre: 'Compatibilidad' },
        dimension: { id: 1, nombre: 'Tecnológica' },
        ir: 3,
        pm: 2,
        subfactores: [
          { id: 11, texto: 'Usa formatos estándar', valor: 2, desconozco: false, respondido: true },
          { id: 12, texto: 'Compatible con varios SO', valor: null, desconozco: false, respondido: false },
        ],
      },
      {
        idProyectoFactor: 502,
        factor: { id: 2, nombre: 'Soporte' },
        dimension: { id: 2, nombre: 'Organizacional' },
        ir: 2,
        pm: 4,
        subfactores: [
          { id: 21, texto: 'Existe soporte técnico formal', valor: 4, desconozco: false, respondido: true },
        ],
      },
    ],
  }
}

/**
 * In-memory fake of the A4 endpoints for project `idProyecto`. Writes mutate the data and
 * the PM answered by the fake is computed with @guios/calculo, like the real API.
 */
export function evaluacionApi(idProyecto: number, softwares: { id: number; nombre: string }[]) {
  const importancias = structuredClone(IMPORTANCIAS)
  const calificaciones = new Map(
    softwares.map((software) => [software.id, calificacionesBase(software.id, software.nombre)]),
  )
  const prefijo = `/api/proyectos/${idProyecto}`

  const handler: FakeHandler = ({ method, path, search, body }) => {
    if (!path.startsWith(prefijo)) return undefined
    const resto = path.slice(prefijo.length)
    const datos = (body ?? {}) as Record<string, unknown>

    if (method === 'GET' && resto === '/importancias/mias') return { status: 200, body: importancias }
    const importancia = /^\/importancias\/(\d+)$/.exec(resto)
    if (method === 'PUT' && importancia) {
      const fila = importancias.find((item) => item.idProyectoFactor === Number(importancia[1]))
      if (!fila) return { status: 404, body: { statusCode: 404, message: 'Factor no encontrado' } }
      fila.impDecisor = Number(datos.impDecisor)
      return { status: 200, body: { idProyectoFactor: fila.idProyectoFactor, impDecisor: fila.impDecisor } }
    }
    if (method === 'GET' && resto === '/calificaciones/mias') {
      const idSoftware = Number(new URLSearchParams(search).get('software'))
      const datosSoftware = calificaciones.get(idSoftware)
      return datosSoftware
        ? { status: 200, body: datosSoftware }
        : { status: 404, body: { statusCode: 404, message: 'Software no encontrado' } }
    }
    if (method === 'PUT' && resto === '/calificaciones') {
      const datosSoftware = calificaciones.get(Number(datos.idSoftware))
      const factor = datosSoftware?.factores.find((item) =>
        item.subfactores.some((sub) => sub.id === Number(datos.idSubfactor)),
      )
      if (!factor) return { status: 404, body: { statusCode: 404, message: 'Subfactor no encontrado' } }
      const subfactor = factor.subfactores.find((sub) => sub.id === Number(datos.idSubfactor))!
      subfactor.respondido = true
      subfactor.desconozco = datos.desconozco === true
      subfactor.valor = subfactor.desconozco ? null : (datos.valor as 1 | 2 | 3 | 4)
      const respuestas: Calificacion[] = factor.subfactores
        .filter((sub) => sub.respondido)
        .map((sub) => (sub.desconozco ? DESCONOZCO : sub.valor!))
      factor.pm = ponderacionMediaJurado(respuestas)
      return { status: 200, body: { idProyectoFactor: factor.idProyectoFactor, pm: factor.pm } }
    }
    return undefined
  }
  return { handler, importancias, calificaciones }
}

/** Tries each handler in order; the first answer wins. */
export function combinar(...handlers: FakeHandler[]): FakeHandler {
  return (request) => {
    for (const handler of handlers) {
      const respuesta = handler(request)
      if (respuesta) return respuesta
    }
    return undefined
  }
}
