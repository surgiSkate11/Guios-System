import { ClipboardList } from 'lucide-react'
import { SelectorProyecto } from '../../components/SelectorProyecto'

/** Entry of "Calificar factores": the projects where the user is an active judge. */
export function CalificarPage() {
  return (
    <SelectorProyecto
      title="Calificar factores"
      subtitle="Elegí el proyecto que vas a evaluar como jurado"
      icon={ClipboardList}
      filtro={(proyecto) => proyecto.miEstadoJurado === 'activo'}
      pantalla="importancia"
      vacio="No tenés proyectos activos como jurado."
    />
  )
}
