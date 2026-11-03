import { Settings } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { OrganizacionesTab } from './OrganizacionesTab'
import { ParametrosTab } from './ParametrosTab'
import { UsuariosTab } from './UsuariosTab'

type Pestana = 'parametros' | 'usuarios' | 'organizaciones'

const PESTANAS: { id: Pestana; titulo: string; contenido: ReactNode }[] = [
  { id: 'parametros', titulo: 'Parámetros de análisis', contenido: <ParametrosTab /> },
  { id: 'usuarios', titulo: 'Usuarios y roles', contenido: <UsuariosTab /> },
  { id: 'organizaciones', titulo: 'Organizaciones', contenido: <OrganizacionesTab /> },
]

/** Administrator screen: analysis parameters, users and roles, organizations (RF-18 prototype 16). */
export function ConfiguracionPage() {
  const [activa, setActiva] = useState<Pestana>('parametros')
  const pestana = PESTANAS.find((item) => item.id === activa)!

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Parámetros del sistema de evaluación"
        icon={Settings}
      />
      <div role="tablist" aria-label="Secciones de configuración" className="mb-5 flex gap-6 border-b border-slate-200">
        {PESTANAS.map(({ id, titulo }) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={id === activa}
            aria-controls="panel-configuracion"
            onClick={() => setActiva(id)}
            className={`-mb-px border-b-2 pb-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-600 ${
              id === activa
                ? 'border-brand-600 font-semibold text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {titulo}
          </button>
        ))}
      </div>
      <div id="panel-configuracion" role="tabpanel" aria-labelledby={`tab-${activa}`}>
        {pestana.contenido}
      </div>
    </>
  )
}
