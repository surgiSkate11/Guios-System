import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '../test/render-route'

const SIDEBAR_TOP_LEVEL = [
  'Inicio',
  'Historial',
  'Jurados',
  'Catálogo de factores',
  'Configuración',
]

const EVALUACIONES_CHILDREN = [
  'Mis evaluaciones',
  'Nuevo proyecto',
  'Calificar factores',
  'Consolidación y alcance',
  'Comparación de softwares',
  'Análisis con IA',
  'Auditoría de jurados',
]

describe('AppLayout', () => {
  it('shows the brand, the search box and the user menu', () => {
    renderRoute('/inicio')
    expect(screen.getByText('GUIOS PRO')).toBeInTheDocument()
    expect(screen.getByText('Evaluación de Software')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar proyectos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  it('shows every sidebar section of the prototype', () => {
    renderRoute('/inicio')
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    for (const label of SIDEBAR_TOP_LEVEL) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('button', { name: 'Evaluaciones' })).toBeInTheDocument()
  })

  it('expands the Evaluaciones group and marks the active child', () => {
    renderRoute('/evaluaciones')
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    for (const label of EVALUACIONES_CHILDREN) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Mis evaluaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Mis evaluaciones' })).toBeInTheDocument()
  })

  it('collapses and expands the Evaluaciones group on click', async () => {
    const user = userEvent.setup()
    renderRoute('/inicio')
    const toggle = screen.getByRole('button', { name: 'Evaluaciones' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Mis evaluaciones' })).not.toBeInTheDocument()

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Mis evaluaciones' })).toBeInTheDocument()
  })

  it('navigates to a section from the sidebar', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/inicio')
    await user.click(screen.getByRole('link', { name: 'Configuración' }))
    expect(router.state.location.pathname).toBe('/admin/configuracion')
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument()
  })
})

describe('routes', () => {
  it('redirects the root path to /inicio', () => {
    const { router } = renderRoute('/')
    expect(router.state.location.pathname).toBe('/inicio')
    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
  })

  it('redirects unknown paths to /inicio', () => {
    const { router } = renderRoute('/no-existe')
    expect(router.state.location.pathname).toBe('/inicio')
  })

  it.each([
    ['/proyectos/nuevo', 'Nuevo proyecto'],
    ['/historial', 'Historial'],
    ['/jurados', 'Jurados'],
    ['/admin/catalogo', 'Catálogo de factores'],
    ['/proyectos/7/consolidacion', 'Consolidación y alcance'],
    ['/proyectos/7/comparacion', 'Comparación de softwares'],
  ])('renders %s with its title', (path, title) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })
})
