import type { EstadoJurado, EstadoProyecto, ProyectoResumen } from '../api/proyectos'
import type { Usuario } from '../auth/session'
import { TEST_TOKEN, type FakeHandler } from './fake-api'

export const DIMENSIONES = [
  { id: 1, nombre: 'Tecnológica' },
  { id: 2, nombre: 'Organizacional' },
]

/** Users the fake search endpoint can find, by e-mail. */
export const USUARIOS_BUSCABLES: Record<string, { id: number; nombre: string; email: string }> = {
  'luis@correo.com': { id: 7, nombre: 'Luis Mora', email: 'luis@correo.com' },
}

/** A project as seen by the coordinator, with sensible defaults. */
export function proyecto(sobrescribir: Partial<ProyectoResumen> = {}): ProyectoResumen {
  return {
    id: 10,
    nombre: 'Sistema de inventario',
    estado: 'borrador',
    metodoConsolidacion: 'mediana',
    fechaInicio: '2026-10-08',
    fechaFin: null,
    versionCatalogo: 1,
    organizacion: { id: 1, nombre: 'Alcaldía Norte' },
    coordinador: { id: 2, nombre: 'Edna Lee', email: 'edna@organizacion.com' },
    softwares: [{ id: 100, nombre: 'Software A', version: '2.1', licencia: 'libre' }],
    jurados: [],
    dimensiones: DIMENSIONES,
    miRol: 'coordinador',
    miEstadoJurado: null,
    ...sobrescribir,
  }
}

/** A project where the signed-in user is a judge (not the coordinator). */
export function proyectoComoJurado(
  estado: EstadoJurado,
  sobrescribir: Partial<ProyectoResumen> = {},
): ProyectoResumen {
  return proyecto({
    id: 20,
    nombre: 'Portal académico',
    estado: 'en_curso',
    coordinador: { id: 5, nombre: 'Rosa Vega', email: 'rosa@organizacion.com' },
    miRol: 'jurado',
    miEstadoJurado: estado,
    ...sobrescribir,
  })
}

const JSON_ERROR = (status: number, message: string) => ({
  status,
  body: { statusCode: status, message },
})

/**
 * In-memory fake of the A3 endpoints (projects, softwares, judges, requests) plus the
 * catalog read the new-project form needs. `proyectos` is mutated by the writes.
 */
export function proyectosApi(inicial: ProyectoResumen[], usuario: Usuario) {
  const proyectos = inicial.map((item) => structuredClone(item))
  let siguienteId = 500

  const buscar = (id: string) => proyectos.find((item) => item.id === Number(id))

  const handler: FakeHandler = ({ method, path, body, search, headers }) => {
    if (headers.authorization !== `Bearer ${TEST_TOKEN}`) return undefined
    const datos = (body ?? {}) as Record<string, unknown>

    if (method === 'GET' && path === '/api/catalogo/vigente') {
      return { status: 200, body: { version: { id: 1, numero: 1 }, dimensiones: DIMENSIONES } }
    }
    if (method === 'GET' && path === '/api/proyectos') return { status: 200, body: proyectos }
    if (method === 'GET' && path === '/api/solicitudes') {
      return { status: 200, body: proyectos.filter((item) => item.miEstadoJurado === 'invitado') }
    }
    if (method === 'GET' && path === '/api/usuarios/buscar') {
      const email = new URLSearchParams(search).get('email') ?? ''
      const encontrado = USUARIOS_BUSCABLES[email]
      return encontrado
        ? { status: 200, body: encontrado }
        : JSON_ERROR(404, 'No se encontró un usuario activo con ese correo')
    }
    if (method === 'POST' && path === '/api/proyectos') {
      const nuevo = proyecto({
        id: siguienteId++,
        nombre: String(datos.nombre),
        estado: 'borrador',
        metodoConsolidacion: datos.metodoConsolidacion as 'mediana' | 'promedio',
        fechaInicio: String(datos.fechaInicio),
        fechaFin: (datos.fechaFin as string | undefined) ?? null,
        softwares: (datos.softwares as { nombre: string; version?: string; licencia?: string }[]).map(
          (software, indice) => ({
            id: 900 + indice,
            nombre: software.nombre,
            version: software.version ?? null,
            licencia: software.licencia ?? null,
          }),
        ),
        dimensiones: DIMENSIONES.filter((dimension) =>
          (datos.idDimensiones as number[]).includes(dimension.id),
        ),
        coordinador: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
      })
      proyectos.unshift(nuevo)
      return { status: 201, body: nuevo }
    }

    const ruta = /^\/api\/proyectos\/(\d+)(\/.*)?$/.exec(path)
    if (!ruta) return undefined
    const actual = buscar(ruta[1]!)
    if (!actual) return JSON_ERROR(404, 'Proyecto no encontrado')
    const resto = ruta[2] ?? ''
    if (method === 'GET' && resto === '') return { status: 200, body: actual }

    if (method === 'POST' && resto === '/softwares') {
      actual.softwares.push({
        id: 300 + actual.softwares.length,
        nombre: String(datos.nombre),
        version: (datos.version as string | undefined) ?? null,
        licencia: (datos.licencia as string | undefined) ?? null,
      })
      return { status: 201, body: actual }
    }
    const software = /^\/softwares\/(\d+)$/.exec(resto)
    if (method === 'DELETE' && software) {
      actual.softwares = actual.softwares.filter((item) => item.id !== Number(software[1]))
      return { status: 200, body: actual }
    }
    if (method === 'POST' && resto === '/estado') {
      actual.estado = datos.estado as EstadoProyecto
      return { status: 200, body: actual }
    }
    if (method === 'POST' && resto === '/jurados') {
      const idUsuario = Number(datos.idUsuario)
      const conocido =
        idUsuario === usuario.id
          ? { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
          : Object.values(USUARIOS_BUSCABLES).find((item) => item.id === idUsuario)
      if (!conocido) return JSON_ERROR(404, 'Usuario no encontrado')
      actual.jurados.push({
        idUsuario,
        nombre: conocido.nombre,
        email: conocido.email,
        estado: idUsuario === usuario.id ? 'activo' : 'invitado',
        idDimensiones: actual.dimensiones.map((dimension) => dimension.id),
      })
      return { status: 201, body: actual }
    }
    const jurado = /^\/jurados\/(\d+)$/.exec(resto)
    if (method === 'DELETE' && jurado) {
      actual.jurados = actual.jurados.filter((item) => item.idUsuario !== Number(jurado[1]))
      return { status: 200, body: actual }
    }
    if (method === 'PATCH' && jurado) {
      const objetivo = actual.jurados.find((item) => item.idUsuario === Number(jurado[1]))
      if (objetivo && datos.estado === 'finalizado') objetivo.estado = 'finalizado'
      return { status: 200, body: actual }
    }
    if (method === 'POST' && resto === '/solicitud/aceptar') {
      actual.miEstadoJurado = 'activo'
      return { status: 200, body: actual }
    }
    if (method === 'POST' && resto === '/solicitud/rechazar') {
      proyectos.splice(proyectos.indexOf(actual), 1)
      return { status: 204 }
    }
    return undefined
  }

  return { handler, proyectos }
}

/** Wraps a handler so the requests matching `coincide` answer with the given API error. */
export function conError(
  base: FakeHandler,
  coincide: (method: string, path: string) => boolean,
  status: number,
  message: string | string[],
): FakeHandler {
  return (request) =>
    coincide(request.method, request.path)
      ? { status, body: { statusCode: status, message } }
      : base(request)
}
