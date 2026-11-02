import type { EstadoJurado, EstadoProyecto, Metodo } from '../../api/proyectos'

export const ETIQUETA_ESTADO: Record<EstadoProyecto, string> = {
  borrador: 'Borrador',
  en_curso: 'En curso',
  cerrado: 'Cerrado',
}

export const ETIQUETA_ESTADO_JURADO: Record<EstadoJurado, string> = {
  invitado: 'Invitado',
  activo: 'Activo',
  finalizado: 'Finalizado',
}

export const ETIQUETA_METODO: Record<Metodo, string> = {
  mediana: 'Mediana',
  promedio: 'Promedio',
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-10-08" -> "08 oct 2026"; parsed by hand so the time zone never shifts the day. */
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  const nombreMes = MESES[Number(mes) - 1]
  return nombreMes && anio && dia ? `${dia} ${nombreMes} ${anio}` : fecha
}

/** "Versión 2.1 · Licencia libre", skipping what the software does not have. */
export function detalleSoftware(software: { version?: string | null; licencia?: string | null }): string {
  return [
    software.version ? `Versión ${software.version}` : null,
    software.licencia ? `Licencia ${software.licencia}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
