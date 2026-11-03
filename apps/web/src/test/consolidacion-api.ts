import type { Consolidacion, FactorConsolidado } from '../api/consolidacion'
import type { FakeHandler } from './fake-api'

function factor(sobrescribir: Partial<FactorConsolidado>): FactorConsolidado {
  return {
    idProyectoFactor: 501,
    factor: { id: 1, nombre: 'Compatibilidad' },
    dimension: { id: 1, nombre: 'Tecnológica' },
    impSugerida: 3,
    importancias: [
      { idUsuario: 3, nombre: 'Ana Pérez', impDecisor: 3 },
      { idUsuario: 7, nombre: 'Luis Mora', impDecisor: 4 },
    ],
    faltantes: 0,
    idConsolidada: 3,
    ir: 3,
    esRelevante: true,
    alcanceDefault: 'interno',
    alcanceEfectivo: 'interno',
    justificacionAlcance: null,
    ...sobrescribir,
  }
}

export function consolidacionBase(): Consolidacion {
  return {
    confirmada: false,
    metodo: 'mediana',
    factores: [
      factor({}),
      factor({
        idProyectoFactor: 502,
        factor: { id: 2, nombre: 'Prueba' },
        impSugerida: 2,
        importancias: [
          { idUsuario: 3, nombre: 'Ana Pérez', impDecisor: 1 },
          { idUsuario: 7, nombre: 'Luis Mora', impDecisor: 1 },
        ],
        idConsolidada: 1,
        ir: 1,
        esRelevante: false,
      }),
      factor({
        idProyectoFactor: 503,
        factor: { id: 3, nombre: 'Documentación' },
        importancias: [
          { idUsuario: 3, nombre: 'Ana Pérez', impDecisor: 3 },
          { idUsuario: 7, nombre: 'Luis Mora', impDecisor: null },
        ],
        faltantes: 1,
        idConsolidada: null,
        ir: null,
        esRelevante: null,
        alcanceDefault: 'externo',
        alcanceEfectivo: 'externo',
      }),
    ],
  }
}

/**
 * In-memory fake of the A5 endpoints and of PATCH /api/proyectos/:id (method change)
 * for project `idProyecto`.
 */
export function consolidacionApi(idProyecto: number, inicial: Consolidacion = consolidacionBase()) {
  const estado = structuredClone(inicial)
  const prefijo = `/api/proyectos/${idProyecto}`

  const handler: FakeHandler = ({ method, path, body }) => {
    if (!path.startsWith(prefijo)) return undefined
    const resto = path.slice(prefijo.length)
    const datos = (body ?? {}) as Record<string, unknown>

    if (method === 'GET' && resto === '/consolidacion') return { status: 200, body: estado }
    if (method === 'POST' && resto === '/consolidacion/confirmar') {
      const faltan = estado.factores.reduce((suma, item) => suma + item.faltantes, 0)
      if (faltan > 0) {
        return {
          status: 409,
          body: { statusCode: 409, message: `Faltan ${faltan} importancias por registrar` },
        }
      }
      estado.confirmada = true
      return { status: 201, body: estado }
    }
    if (method === 'PATCH' && resto === '' && datos.metodoConsolidacion) {
      estado.metodo = datos.metodoConsolidacion as Consolidacion['metodo']
      return { status: 200, body: { id: idProyecto, metodoConsolidacion: estado.metodo } }
    }
    const alcance = /^\/factores\/(\d+)\/alcance$/.exec(resto)
    if (method === 'PATCH' && alcance) {
      const fila = estado.factores.find((item) => item.idProyectoFactor === Number(alcance[1]))
      if (!fila) return { status: 404, body: { statusCode: 404, message: 'Factor no encontrado' } }
      if (datos.alcance !== fila.alcanceDefault && !datos.justificacion) {
        return {
          status: 400,
          body: { statusCode: 400, message: 'La justificación es obligatoria al reclasificar' },
        }
      }
      fila.alcanceEfectivo = datos.alcance as FactorConsolidado['alcanceEfectivo']
      fila.justificacionAlcance = (datos.justificacion as string | undefined) ?? null
      return { status: 200, body: fila }
    }
    return undefined
  }
  return { handler, estado }
}
