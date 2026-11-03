import { avisosEstimacion } from '@guios/calculo'
import type { CatalogoVigente, Estimacion, FactorAdmin } from '../api/catalogo'
import type { FakeHandler } from './fake-api'

/** Cut points of the specification example (section 6): rq1 1.56, rq2 2.00, rq3 2.10. */
export const CORTES = { rq1: 1.56, rq2: 2, rq3: 2.1 }

export const VIGENTE: CatalogoVigente = {
  version: { id: 1, numero: 1, fecha: '2026-10-01', motivo: 'Carga inicial de la tesis', ...CORTES },
  dimensiones: [
    {
      id: 1,
      nombre: 'Tecnológica',
      factores: [
        {
          id: 1,
          nombre: 'Compatibilidad',
          sugeridaDefault: 3,
          alcanceDefault: 'interno',
          origen: 'tesis',
          validadoExpertos: true,
          subfactores: [{ id: 11, texto: 'El software usa formatos estándar' }],
        },
      ],
    },
    { id: 2, nombre: 'Organizacional', factores: [] },
  ],
}

type Cita = { texto: string; citas: number; dois?: string[] }

/** Factors as administered (A10): one active and one inactive. */
export function factoresAdmin(): FactorAdmin[] {
  return [
    {
      id: 1,
      nombre: 'Compatibilidad',
      idDimension: 1,
      dimension: { id: 1, nombre: 'Tecnológica' },
      sugeridaDefault: 3,
      alcanceDefault: 'interno',
      origen: 'tesis',
      isOrigen: 'tesis',
      validadoExpertos: true,
      activo: true,
      subfactores: [
        { id: 11, texto: 'El software usa formatos estándar', activo: true },
        { id: 12, texto: 'El software exporta a formatos propietarios', activo: false },
      ],
    },
    {
      id: 2,
      nombre: 'Reusabilidad',
      idDimension: 1,
      dimension: { id: 1, nombre: 'Tecnológica' },
      sugeridaDefault: 2,
      alcanceDefault: 'interno',
      origen: 'lit_2020_2025',
      isOrigen: 'manual',
      validadoExpertos: true,
      activo: false,
      subfactores: [{ id: 21, texto: 'El código se puede reutilizar', activo: true }],
    },
  ]
}

/** Computes the estimation fields like the server does (RN-01, RN-02, RN-04 via @guios/calculo). */
function calcular(estimacion: Estimacion): Estimacion {
  const tc = estimacion.subfactores.reduce((suma, sub) => suma + sub.citas, 0)
  const ns = estimacion.subfactores.length
  const avisos = avisosEstimacion(tc, ns, estimacion.cortes)
  return {
    ...estimacion,
    tc,
    ns,
    r: avisos.r,
    il: avisos.il,
    isPropuesta: avisos.is,
    resultadoSensible: avisos.resultadoSensible,
    sinEvidencia: avisos.sinEvidencia,
    sinRespaldoVerificable: estimacion.subfactores.some((sub) => sub.citas > 0 && sub.dois.length === 0),
  }
}

export function estimacionDe(id: number, nombre: string, subfactores: Cita[]): Estimacion {
  return calcular({
    id,
    estado: 'propuesta',
    modo: 'manual',
    factor: { id: 70, nombre, idDimension: 2, alcanceDefault: 'externo' },
    subfactores: subfactores.map((sub, indice) => ({
      id: 700 + indice,
      texto: sub.texto,
      citas: sub.citas,
      dois: sub.dois ?? [],
    })),
    cortes: CORTES,
    tc: null,
    ns: 0,
    r: null,
    il: null,
    isPropuesta: null,
    isAprobada: null,
    resultadoSensible: false,
    sinEvidencia: false,
    sinRespaldoVerificable: false,
    progreso: null,
    error: null,
    justificacion: null,
    creadoEn: '2026-10-09T15:42:00.000Z',
  })
}

/**
 * In-memory fake of A2 (current catalog) and A10 (factor creation, estimations). An AI
 * estimation stays `en_curso` for `pasosIa` polls, then becomes a proposal.
 */
export function catalogoApi(opciones: { estimaciones?: Estimacion[]; iaConfigurada?: boolean; pasosIa?: number } = {}) {
  const estimaciones = (opciones.estimaciones ?? []).map((item) => structuredClone(item))
  const factores = factoresAdmin()
  const pasos = new Map<number, number>()
  let siguiente = 900

  const buscar = (id: number) => estimaciones.find((item) => item.id === id)
  const error = (status: number, message: string) => ({ status, body: { statusCode: status, message } })

  const handler: FakeHandler = ({ method, path, search, body }) => {
    const datos = (body ?? {}) as Record<string, unknown>
    if (method === 'GET' && path === '/api/catalogo/vigente') return { status: 200, body: VIGENTE }
    if (method === 'GET' && path === '/api/catalogo/versiones') return { status: 200, body: [] }
    if (method === 'GET' && path === '/api/catalogo/estimaciones') {
      const estado = new URLSearchParams(search).get('estado')
      return { status: 200, body: estimaciones.filter((item) => !estado || item.estado === estado) }
    }
    if (method === 'POST' && path === '/api/catalogo/factores') {
      const nueva = estimacionDe(siguiente++, String(datos.nombre), datos.subfactores as Cita[])
      nueva.factor = {
        id: 80,
        nombre: String(datos.nombre),
        idDimension: Number(datos.idDimension),
        alcanceDefault: datos.alcanceDefault as 'interno' | 'externo',
      }
      estimaciones.unshift(nueva)
      return { status: 201, body: nueva }
    }
    if (method === 'GET' && path === '/api/catalogo/factores') return { status: 200, body: factores }
    const factor = /^\/api\/catalogo\/factores\/(\d+)$/.exec(path)
    if (method === 'PATCH' && factor) {
      const fila = factores.find((item) => item.id === Number(factor[1]))
      if (!fila) return error(404, 'Factor no encontrado')
      Object.assign(fila, datos)
      return { status: 200, body: fila }
    }
    const nuevoSub = /^\/api\/catalogo\/factores\/(\d+)\/subfactores$/.exec(path)
    if (method === 'POST' && nuevoSub) {
      const fila = factores.find((item) => item.id === Number(nuevoSub[1]))!
      const sub = { id: 600 + fila.subfactores.length, texto: String(datos.texto), activo: true }
      fila.subfactores.push(sub)
      return { status: 201, body: sub }
    }
    const subfactor = /^\/api\/catalogo\/subfactores\/(\d+)$/.exec(path)
    if (method === 'PATCH' && subfactor) {
      const sub = factores.flatMap((item) => item.subfactores).find((item) => item.id === Number(subfactor[1]))
      if (!sub) return error(404, 'Subfactor no encontrado')
      Object.assign(sub, datos)
      return { status: 200, body: sub }
    }
    const ia = /^\/api\/catalogo\/factores\/(\d+)\/estimaciones$/.exec(path)
    if (method === 'POST' && ia) {
      if (!opciones.iaConfigurada) return error(409, 'La estimación con IA no está configurada')
      const base = estimaciones.find((item) => item.factor.id === Number(ia[1]))!
      const nueva: Estimacion = {
        ...structuredClone(base),
        id: siguiente++,
        modo: 'ia',
        estado: 'en_curso',
        progreso: { hechos: 0, total: base.subfactores.length },
      }
      pasos.set(nueva.id, 0)
      estimaciones.unshift(nueva)
      return { status: 202, body: nueva }
    }
    const una = /^\/api\/catalogo\/estimaciones\/(\d+)(\/aprobar|\/rechazar)?$/.exec(path)
    if (!una) return undefined
    const actual = buscar(Number(una[1]))
    if (!actual) return error(404, 'Estimación no encontrada')
    if (method === 'GET' && !una[2]) {
      if (actual.estado === 'en_curso') {
        const hechos = (pasos.get(actual.id) ?? 0) + 1
        pasos.set(actual.id, hechos)
        if (hechos >= (opciones.pasosIa ?? 1)) {
          actual.estado = 'propuesta'
          actual.progreso = null
          actual.subfactores = actual.subfactores.map((sub) => ({ ...sub, citas: sub.citas + 1, dois: ['10.1000/ia'] }))
          Object.assign(actual, calcular(actual))
        } else {
          actual.progreso = { hechos, total: actual.subfactores.length }
        }
      }
      return { status: 200, body: actual }
    }
    if (actual.estado !== 'propuesta') return error(409, 'Solo se puede decidir una propuesta')
    if (method === 'POST' && una[2] === '/aprobar') {
      for (const cambio of (datos.citas as { idSubfactor: number; citas: number }[] | undefined) ?? []) {
        const sub = actual.subfactores.find((item) => item.id === cambio.idSubfactor)
        if (sub) sub.citas = cambio.citas
      }
      Object.assign(actual, calcular(actual))
      const isAprobada = (datos.isAprobada as number | undefined) ?? actual.isPropuesta
      if (isAprobada !== actual.isPropuesta && !datos.justificacion) {
        return error(400, 'La justificación es obligatoria si la IS aprobada difiere de la calculada')
      }
      Object.assign(actual, {
        estado: 'aprobada',
        isAprobada,
        justificacion: (datos.justificacion as string | undefined) ?? null,
      })
      return { status: 201, body: actual }
    }
    if (method === 'POST' && una[2] === '/rechazar') {
      Object.assign(actual, { estado: 'rechazada', justificacion: datos.justificacion })
      return { status: 201, body: actual }
    }
    return undefined
  }
  return { handler, estimaciones, factores }
}
