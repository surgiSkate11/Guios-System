import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { ProyectosProvider } from '../proyectos/ProyectosProvider'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Authenticated shell: sidebar, top bar and the current page. */
export function AppLayout() {
  // Below the lg breakpoint (tablets, RNF-10) the sidebar becomes a drawer.
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    if (!menuAbierto) return
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('keydown', cerrarConEscape)
    return () => document.removeEventListener('keydown', cerrarConEscape)
  }, [menuAbierto])

  return (
    <ProyectosProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>
      <div className="flex h-full">
        {menuAbierto && (
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            onClick={() => setMenuAbierto(false)}
          />
        )}
        <Sidebar abierta={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar menuAbierto={menuAbierto} onAlternarMenu={() => setMenuAbierto((v) => !v)} />
          <main
            id="contenido"
            tabIndex={-1}
            className="flex-1 overflow-y-auto px-4 py-5 focus:outline-none sm:px-6 lg:px-8 lg:py-7"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </ProyectosProvider>
  )
}
