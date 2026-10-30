import {
  BarChart3,
  Bot,
  ClipboardCheck,
  ClipboardList,
  FolderPlus,
  GitCompareArrows,
  History,
  House,
  Layers,
  ListChecks,
  ScanSearch,
  Settings,
  Users,
} from 'lucide-react'
import { Navigate, type RouteObject } from 'react-router'
import { AppLayout } from './layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { PendingAuthPage } from './pages/auth/PendingAuthPage'
import { PlaceholderPage, type PlaceholderPageProps } from './pages/PlaceholderPage'

/** Screens of the authenticated area; each one becomes a real module later. */
const SCREENS: Record<string, PlaceholderPageProps> = {
  inicio: {
    title: 'Inicio',
    subtitle: 'Resumen de tus proyectos de evaluación',
    icon: House,
    covers: 'panel de inicio y pendientes',
  },
  evaluaciones: {
    title: 'Mis evaluaciones',
    subtitle: 'Proyectos de evaluación de software',
    icon: ClipboardCheck,
    covers: 'RF-17, listado de proyectos por estado',
  },
  nuevoProyecto: {
    title: 'Nuevo proyecto',
    subtitle: 'Crea una evaluación en tres pasos',
    icon: FolderPlus,
    covers: 'RF-02, RF-03, HU-01, HU-19',
  },
  calificar: {
    title: 'Calificar factores',
    subtitle: 'Importancia de factores y calificación de subfactores',
    icon: ClipboardList,
    covers: 'RF-04, RF-08, HU-02, HU-05',
  },
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
  jurados: {
    title: 'Jurados',
    subtitle: 'Jurados asignados y su estado',
    icon: Users,
    covers: 'RF-03, HU-19',
  },
  catalogo: {
    title: 'Catálogo de factores',
    subtitle: 'Factores, subfactores y versiones del catálogo',
    icon: ListChecks,
    covers: 'RF-18, RF-22 a RF-24, HU-12, HU-21 a HU-24',
  },
  configuracion: {
    title: 'Configuración',
    subtitle: 'Parámetros del sistema de evaluación',
    icon: Settings,
    covers: 'parámetros de análisis, usuarios, roles y organizaciones',
  },
}

function screen(key: keyof typeof SCREENS) {
  return <PlaceholderPage {...SCREENS[key]!} />
}

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/registro',
    element: <PendingAuthPage title="Crear cuenta" covers="RF-01, HU-18" />,
  },
  {
    path: '/recuperar',
    element: <PendingAuthPage title="Recuperar contraseña" covers="RF-25" />,
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/inicio" replace /> },
      { path: 'inicio', element: screen('inicio') },
      { path: 'evaluaciones', element: screen('evaluaciones') },
      { path: 'evaluaciones/calificar', element: screen('calificar') },
      { path: 'evaluaciones/consolidacion', element: screen('consolidacion') },
      { path: 'evaluaciones/comparacion', element: screen('comparacion') },
      { path: 'evaluaciones/analisis', element: screen('analisis') },
      { path: 'evaluaciones/auditoria', element: screen('auditoria') },
      { path: 'proyectos/nuevo', element: screen('nuevoProyecto') },
      { path: 'proyectos/:id/importancia', element: screen('calificar') },
      { path: 'proyectos/:id/subfactores', element: screen('calificar') },
      { path: 'proyectos/:id/resultado', element: screen('resultado') },
      { path: 'proyectos/:id/consolidacion', element: screen('consolidacion') },
      { path: 'proyectos/:id/comparacion', element: screen('comparacion') },
      { path: 'proyectos/:id/analisis', element: screen('analisis') },
      { path: 'proyectos/:id/auditoria', element: screen('auditoria') },
      { path: 'historial', element: screen('historial') },
      { path: 'jurados', element: screen('jurados') },
      { path: 'admin/catalogo', element: screen('catalogo') },
      { path: 'admin/configuracion', element: screen('configuracion') },
    ],
  },
  { path: '*', element: <Navigate to="/inicio" replace /> },
]
