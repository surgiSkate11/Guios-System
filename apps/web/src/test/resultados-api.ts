import type { Auditoria, ResultadoMio, ResultadoProyecto } from '../api/resultados'
import type { FakeHandler } from './fake-api'

export function resultadoBase(): ResultadoProyecto {
  return {
    generadoEn: null,
    softwares: [
      {
        id: 100,
        nombre: 'Software A',
        ranking: 1,
        nivel: 'C',
        metrica: { final: 72.3, minimo: 66.4, maximo: 78.2, desviacion: 4.1 },
        scoresJurado: [
          { idUsuario: 3, nombre: 'Ana Pérez', score: 78.2 },
          { idUsuario: 7, nombre: 'Luis Mora', score: 66.4 },
        ],
        factores: [
          {
            idProyectoFactor: 501,
            nombre: 'Compatibilidad',
            ir: 3,
            alcance: 'interno',
            pmPorJurado: [
              { idUsuario: 3, pm: 3 },
              { idUsuario: 7, pm: 3 },
            ],
            pmConsolidada: 3,
            foda: 'fortaleza',
          },
          {
            idProyectoFactor: 502,
            nombre: 'Soporte',
            ir: 3,
            alcance: 'externo',
            pmPorJurado: [
              { idUsuario: 3, pm: 1 },
              { idUsuario: 7, pm: 3 },
            ],
            pmConsolidada: 2,
            foda: 'amenaza',
          },
        ],
      },
      {
        id: 101,
        nombre: 'Software B',
        ranking: 2,
        nivel: 'B',
        metrica: { final: 70, minimo: 62, maximo: 76.5, desviacion: 5 },
        scoresJurado: [
          { idUsuario: 3, nombre: 'Ana Pérez', score: 76.5 },
          { idUsuario: 7, nombre: 'Luis Mora', score: null },
        ],
        factores: [
          {
            idProyectoFactor: 501,
            nombre: 'Compatibilidad',
            ir: 3,
            alcance: 'interno',
            pmPorJurado: [{ idUsuario: 3, pm: 4 }],
            pmConsolidada: 4,
            foda: 'fortaleza',
          },
        ],
      },
    ],
    banderas: [
      {
        tipo: 'metrica_contra_nivel',
        mensaje: 'Software A lidera la métrica pero tiene nivel C',
        idSoftware: 100,
      },
      { tipo: 'factor_discutido', mensaje: 'Soporte supera el umbral de 2', idProyectoFactor: 502 },
    ],
  }
}

export function resultadoMioBase(): ResultadoMio {
  return {
    softwares: [
      {
        id: 100,
        nombre: 'Software A',
        score: 78.2,
        factores: [
          { idProyectoFactor: 501, nombre: 'Compatibilidad', pm: 3, foda: 'fortaleza' },
          { idProyectoFactor: 502, nombre: 'Soporte', pm: null, foda: null },
        ],
      },
      {
        id: 101,
        nombre: 'Software B',
        score: null,
        factores: [{ idProyectoFactor: 501, nombre: 'Compatibilidad', pm: 2, foda: 'debilidad' }],
      },
    ],
  }
}

export function auditoriaBase(): Auditoria {
  return {
    jurados: [
      {
        idUsuario: 3,
        nombre: 'Ana Pérez',
        estado: 'activo',
        importancias: [
          { idProyectoFactor: 501, factor: 'Compatibilidad', impDecisor: 3 },
          { idProyectoFactor: 502, factor: 'Soporte', impDecisor: 4 },
        ],
        calificaciones: { total: 6, desconozco: 0, porcentajeDesconozco: 0 },
        scores: [
          { idSoftware: 100, score: 78.2 },
          { idSoftware: 101, score: 76.5 },
        ],
      },
      {
        idUsuario: 7,
        nombre: 'Luis Mora',
        estado: 'activo',
        importancias: [
          { idProyectoFactor: 501, factor: 'Compatibilidad', impDecisor: 4 },
          { idProyectoFactor: 502, factor: 'Soporte', impDecisor: null },
        ],
        calificaciones: { total: 4, desconozco: 2, porcentajeDesconozco: 50 },
        scores: [
          { idSoftware: 100, score: 66.4 },
          { idSoftware: 101, score: null },
        ],
      },
    ],
  }
}

/** In-memory fake of the A6 endpoints of project `idProyecto`. */
export function resultadosApi(
  idProyecto: number,
  opciones: { persistido?: ResultadoProyecto | null } = {},
) {
  const estado = { persistido: opciones.persistido ?? null }
  const prefijo = `/api/proyectos/${idProyecto}`

  const handler: FakeHandler = ({ method, path }) => {
    if (!path.startsWith(prefijo)) return undefined
    const resto = path.slice(prefijo.length)
    if (method === 'GET' && resto === '/resultados/vista-previa') return { status: 200, body: resultadoBase() }
    if (method === 'POST' && resto === '/resultados') {
      estado.persistido = { ...resultadoBase(), generadoEn: '2026-10-09T15:42:00.000Z' }
      return { status: 201, body: estado.persistido }
    }
    if (method === 'GET' && resto === '/resultados') {
      return estado.persistido
        ? { status: 200, body: estado.persistido }
        : { status: 404, body: { statusCode: 404, message: 'Aún no hay resultados' } }
    }
    if (method === 'GET' && resto === '/resultados/mio') return { status: 200, body: resultadoMioBase() }
    if (method === 'GET' && resto === '/auditoria') return { status: 200, body: auditoriaBase() }
    return undefined
  }
  return { handler, estado }
}
