import type { EstadoEstimacion } from '../../api/catalogo'

export const ETIQUETA_ESTADO_ESTIMACION: Record<EstadoEstimacion, string> = {
  en_curso: 'En curso',
  propuesta: 'Propuesta',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
}
