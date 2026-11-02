import {
  BarChart3,
  Bot,
  GitCompareArrows,
  History,
  Layers,
  ListChecks,
  ScanSearch,
} from 'lucide-react'
import { Navigate, type RouteObject } from 'react-router'
import { AuthRoot, PublicOnly, RequireAuth } from './auth/guards'
import { AppLayout } from './layout/AppLayout'
import { CalificarPage } from './pages/evaluacion/CalificarPage'
import { ImportanciaPage } from './pages/evaluacion/ImportanciaPage'
import { SubfactoresPage } from './pages/evaluacion/SubfactoresPage'
import { LoginPage } from './pages/auth/LoginPage'
import { PendingAuthPage } from './pages/auth/PendingAuthPage'
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
  consolidacion: {
    title: 'Consolidación y alcance',
    subtitle: 'Importancia relativa, relevancia y alcance de los factores',
    icon: Layers,
    covers: 'RF-05 a RF-07, HU-03, HU-04',
  },
  resultado: {
    title: 'Resultado',
    subtitle: 'FODA, métrica y nivel de adopción por software',
    icon: BarChart3,
    covers: 'RF-09 a RF-13, HU-06',
  },
  comparacion: {
    title: 'Comparación de softwares',
    subtitle: 'Ranking, métrica, FODA y dispersión',
    icon: GitCompareArrows,
    covers: 'RF-14, RF-15, RF-19, HU-07, HU-08',
  },
  analisis: {
    title: 'Análisis con IA',
    subtitle: 'Análisis en texto asistido por inteligencia artificial',
    icon: Bot,
    covers: 'RF-16, HU-09',
  },
  auditoria: {
    title: 'Auditoría de jurados',
    subtitle: 'Importancias y calificaciones de cada jurado',
    icon: ScanSearch,
    covers: 'RF-20, HU-13',
  },
  historial: {
    title: 'Historial',
    subtitle: 'Proyectos anteriores y versión del catálogo utilizada',
    icon: History,
    covers: 'RF-17, HU-11',
  },
  catalogo: {
    title: 'Catálogo de factores',
    subtitle: 'Factores, subfactores y versiones del catálogo',
    icon: ListChecks,
    covers: 'RF-18, RF-22 a RF-24, HU-12, HU-21 a HU-24',
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
    element: <PendingAuthPage title="Recuperar contraseña" covers="RF-25" />,
  },
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
      { path: 'evaluaciones/consolidacion', element: screen('consolidacion') },
      { path: 'evaluaciones/comparacion', element: screen('comparacion') },
      { path: 'evaluaciones/analisis', element: screen('analisis') },
      { path: 'evaluaciones/auditoria', element: screen('auditoria') },
      { path: 'proyectos/nuevo', element: <NuevoProyectoPage /> },
      { path: 'proyectos/:id', element: <ProyectoDetallePage /> },
      { path: 'proyectos/:id/importancia', element: <ImportanciaPage /> },
      { path: 'proyectos/:id/subfactores', element: <SubfactoresPage /> },
      { path: 'proyectos/:id/resultado', element: screen('resultado') },
      { path: 'proyectos/:id/consolidacion', element: screen('consolidacion') },
      { path: 'proyectos/:id/comparacion', element: screen('comparacion') },
      { path: 'proyectos/:id/analisis', element: screen('analisis') },
      { path: 'proyectos/:id/auditoria', element: screen('auditoria') },
      { path: 'historial', element: screen('historial') },
      { path: 'jurados', element: <JuradosPage /> },
      { path: 'admin/catalogo', element: screen('catalogo') },
      { path: 'admin/configuracion', element: <ConfiguracionPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/inicio" replace /> },
]

export const routes: RouteObject[] = [{ element: <AuthRoot />, children: appRoutes }]
