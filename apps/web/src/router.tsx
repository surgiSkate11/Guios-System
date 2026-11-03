import {
  Bot,
} from 'lucide-react'
import { Navigate, type RouteObject } from 'react-router'
import { AuthRoot, PublicOnly, RequireAuth } from './auth/guards'
import { AppLayout } from './layout/AppLayout'
import { ConsolidacionPage, ConsolidacionSelectorPage } from './pages/consolidacion/ConsolidacionPage'
import { AuditoriaPage, AuditoriaSelectorPage } from './pages/resultados/AuditoriaPage'
import { ComparacionPage, ComparacionSelectorPage } from './pages/resultados/ComparacionPage'
import { ResultadoPage } from './pages/resultados/ResultadoPage'
import { CatalogoPage } from './pages/catalogo/CatalogoPage'
import { HistorialPage } from './pages/proyectos/HistorialPage'
import { CalificarPage } from './pages/evaluacion/CalificarPage'
import { ImportanciaPage } from './pages/evaluacion/ImportanciaPage'
import { SubfactoresPage } from './pages/evaluacion/SubfactoresPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RecuperarPage } from './pages/auth/RecuperarPage'
import { RestablecerPage } from './pages/auth/RestablecerPage'
import { RegistroPage } from './pages/auth/RegistroPage'
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage'
import { EvaluacionesPage } from './pages/proyectos/EvaluacionesPage'
import { InicioPage } from './pages/proyectos/InicioPage'
import { JuradosPage } from './pages/proyectos/JuradosPage'
import { NuevoProyectoPage } from './pages/proyectos/NuevoProyectoPage'
import { ProyectoDetallePage } from './pages/proyectos/ProyectoDetallePage'
import { PlaceholderPage, type PlaceholderPageProps } from './pages/PlaceholderPage'

/** Screens of the authenticated area; each one becomes a real module later. */
const SCREENS: Record<string, PlaceholderPageProps> = {
  analisis: {
    title: 'Análisis con IA',
    subtitle: 'Análisis en texto asistido por inteligencia artificial',
    icon: Bot,
    covers: 'RF-16, HU-09',
  },
}

function screen(key: keyof typeof SCREENS) {
  return <PlaceholderPage {...SCREENS[key]!} />
}

const appRoutes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/registro',
    element: (
      <PublicOnly>
        <RegistroPage />
      </PublicOnly>
    ),
  },
  {
    path: '/recuperar',
    element: <RecuperarPage />,
  },
  { path: '/restablecer', element: <RestablecerPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/inicio" replace /> },
      { path: 'inicio', element: <InicioPage /> },
      { path: 'evaluaciones', element: <EvaluacionesPage /> },
      { path: 'evaluaciones/calificar', element: <CalificarPage /> },
      { path: 'evaluaciones/consolidacion', element: <ConsolidacionSelectorPage /> },
      { path: 'evaluaciones/comparacion', element: <ComparacionSelectorPage /> },
      { path: 'evaluaciones/analisis', element: screen('analisis') },
      { path: 'evaluaciones/auditoria', element: <AuditoriaSelectorPage /> },
      { path: 'proyectos/nuevo', element: <NuevoProyectoPage /> },
      { path: 'proyectos/:id', element: <ProyectoDetallePage /> },
      { path: 'proyectos/:id/importancia', element: <ImportanciaPage /> },
      { path: 'proyectos/:id/subfactores', element: <SubfactoresPage /> },
      { path: 'proyectos/:id/resultado', element: <ResultadoPage /> },
      { path: 'proyectos/:id/consolidacion', element: <ConsolidacionPage /> },
      { path: 'proyectos/:id/comparacion', element: <ComparacionPage /> },
      { path: 'proyectos/:id/analisis', element: screen('analisis') },
      { path: 'proyectos/:id/auditoria', element: <AuditoriaPage /> },
      { path: 'historial', element: <HistorialPage /> },
      { path: 'jurados', element: <JuradosPage /> },
      { path: 'admin/catalogo', element: <CatalogoPage /> },
      { path: 'admin/configuracion', element: <ConfiguracionPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/inicio" replace /> },
]

export const routes: RouteObject[] = [{ element: <AuthRoot />, children: appRoutes }]
