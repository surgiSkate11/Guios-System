import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TOKEN_KEY } from '../auth/session'
import { ADMINISTRADOR, COORDINADOR, INVITADO, sessionHandler } from '../test/fake-api'
import { proyecto, proyectoComoJurado, proyectosApi } from '../test/proyectos-api'
import { renderRoute } from '../test/render-route'

const COORDINADOR_TOP_LEVEL = ['Inicio', 'Historial', 'Jurados']

/** Coordinator who also judges their project: the menu then offers every project screen. */
const conProyecto = () => proyectosApi([proyecto({ miEstadoJurado: 'activo' })], COORDINADOR).handler
const ADMINISTRADOR_TOP_LEVEL = ['Inicio', 'Catálogo de factores', 'Configuración']

const EVALUACIONES_CHILDREN = [
  'Mis evaluaciones',
  'Nuevo proyecto',
  'Calificar factores',
  'Consolidación y alcance',
  'Comparación de softwares',
  'Análisis con IA',
  'Auditoría de jurados',
]

async function findNav() {
  return screen.findByRole('navigation', { name: 'Navegación principal' })
}

describe('AppLayout', () => {
  it('shows the brand, the search box and the user menu with the real name', async () => {
    renderRoute('/inicio', { usuario: COORDINADOR })
    expect(await screen.findByText('GUIOS PRO')).toBeInTheDocument()
    expect(screen.getByText('Evaluación de Software')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar proyectos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edna Lee/ })).toBeInTheDocument()
  })

  it('shows every coordinator sidebar section of the prototype', async () => {
    renderRoute('/inicio', { usuario: COORDINADOR, api: conProyecto() })
    const nav = await findNav()
    for (const label of COORDINADOR_TOP_LEVEL) {
      expect(await within(nav).findByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('button', { name: 'Evaluaciones' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Catálogo de factores' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument()
  })

  it('shows the administrator sections and hides the project ones', async () => {
    renderRoute('/inicio', { usuario: ADMINISTRADOR })
    const nav = await findNav()
    for (const label of ADMINISTRADOR_TOP_LEVEL) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(nav).queryByRole('button', { name: 'Evaluaciones' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Historial' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Jurados' })).not.toBeInTheDocument()
  })

  it('shows a user without projects only Inicio and Mis evaluaciones (HU-18)', async () => {
    const user = userEvent.setup()
    renderRoute('/inicio', { usuario: INVITADO, api: proyectosApi([], INVITADO).handler })
    const nav = await findNav()
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Inicio'])
    await user.click(within(nav).getByRole('button', { name: 'Evaluaciones' }))
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Inicio',
      'Mis evaluaciones',
    ])
  })

  it('shows Calificar factores to a user that is an active judge of a project', async () => {
    const user = userEvent.setup()
    const { handler } = proyectosApi([proyectoComoJurado('activo')], INVITADO)
    renderRoute('/inicio', { usuario: INVITADO, api: handler })
    const nav = await findNav()
    await user.click(within(nav).getByRole('button', { name: 'Evaluaciones' }))
    expect(await within(nav).findByRole('link', { name: 'Calificar factores' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Consolidación y alcance' })).not.toBeInTheDocument()
  })

  it('hides the coordinator project screens while the coordinator has no project', async () => {
    const user = userEvent.setup()
    renderRoute('/inicio', { usuario: COORDINADOR, api: proyectosApi([], COORDINADOR).handler })
    const nav = await findNav()
    await user.click(within(nav).getByRole('button', { name: 'Evaluaciones' }))
    expect(within(nav).getByRole('link', { name: 'Nuevo proyecto' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Consolidación y alcance' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Jurados' })).not.toBeInTheDocument()
  })

  it('does not ask the API for projects when the user is an administrator', async () => {
    const { requests } = renderRoute('/inicio', { usuario: ADMINISTRADOR })
    await findNav()
    expect(requests.filter((request) => /proyectos|solicitudes/.test(request.path))).toEqual([])
  })

  it('expands the Evaluaciones group and marks the active child', async () => {
    renderRoute('/evaluaciones', { usuario: COORDINADOR, api: conProyecto() })
    const nav = await findNav()
    for (const label of EVALUACIONES_CHILDREN) {
      expect(await within(nav).findByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Mis evaluaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Mis evaluaciones' })).toBeInTheDocument()
  })

  it('collapses and expands the Evaluaciones group on click', async () => {
    const user = userEvent.setup()
    renderRoute('/inicio', { usuario: COORDINADOR })
    const toggle = await screen.findByRole('button', { name: 'Evaluaciones' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Mis evaluaciones' })).not.toBeInTheDocument()

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Mis evaluaciones' })).toBeInTheDocument()
  })

  it('navigates to a section from the sidebar', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/inicio', { usuario: ADMINISTRADOR })
    await user.click(within(await findNav()).getByRole('link', { name: 'Configuración' }))
    expect(router.state.location.pathname).toBe('/admin/configuracion')
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument()
  })

  it('signs out from the user menu', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/inicio', { usuario: COORDINADOR })
    await user.click(await screen.findByRole('button', { name: /Edna Lee/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})

describe('routes', () => {
  it('redirects the root path to /inicio', async () => {
    const { router } = renderRoute('/', { usuario: COORDINADOR })
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inicio')
  })

  it('redirects unknown paths to /inicio', async () => {
    const { router } = renderRoute('/no-existe', { usuario: COORDINADOR })
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
  })

  it.each([
    ['/proyectos/nuevo', 'Nuevo proyecto de evaluación', COORDINADOR],
    ['/historial', 'Historial', COORDINADOR],
    ['/jurados', 'Jurados', COORDINADOR],
    ['/admin/catalogo', 'Catálogo de factores', ADMINISTRADOR],
    ['/proyectos/7/consolidacion', 'Consolidación y alcance', COORDINADOR],
    ['/proyectos/7/comparacion', 'Comparación de softwares', COORDINADOR],
  ])('renders %s with its title', async (path, title, usuario) => {
    renderRoute(path, { usuario })
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('sends a visitor without session to /login', async () => {
    const { router } = renderRoute('/evaluaciones')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('drops an expired token and sends the visitor to /login', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token')
    // The fake API only accepts TEST_TOKEN, so the stored token gets a 401.
    const { router, requests } = renderRoute('/inicio', { api: sessionHandler(COORDINADOR) })
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(requests[0]).toMatchObject({
      method: 'GET',
      path: '/api/auth/me',
      headers: { authorization: 'Bearer expired-token' },
    })
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it.each([
    ['/admin/configuracion', INVITADO],
    ['/admin/catalogo', INVITADO],
    ['/proyectos/nuevo', INVITADO],
    ['/evaluaciones/auditoria', INVITADO],
    ['/proyectos/7/comparacion', INVITADO],
    ['/admin/configuracion', COORDINADOR],
    ['/proyectos/nuevo', ADMINISTRADOR],
    ['/jurados', INVITADO],
    ['/evaluaciones/consolidacion', INVITADO],
    ['/evaluaciones', ADMINISTRADOR],
    ['/proyectos/7', ADMINISTRADOR],
  ])('redirects %s to /inicio when the role cannot open it', async (path, usuario) => {
    const { router } = renderRoute(path, { usuario })
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inicio')
  })
})
