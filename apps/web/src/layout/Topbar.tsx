import { Bell, ChevronDown, LogOut, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/auth-context'

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

function UserMenu({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white"
        >
          {initialsOf(userName)}
        </span>
        <span className="text-[15px] font-medium text-slate-800">{userName}</span>
        <ChevronDown aria-hidden className="size-4 text-slate-500" />
      </button>
      {open && (
        <div
          id="user-menu"
          role="menu"
          aria-label="Menú de usuario"
          className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <LogOut aria-hidden className="size-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function Topbar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
      <label className="relative w-full max-w-md">
        <span className="sr-only">Buscar proyectos</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          placeholder="Buscar proyectos..."
          className="w-full rounded-lg bg-slate-100 py-2.5 pr-4 pl-11 text-sm placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-brand-600"
        />
      </label>
      <div className="flex items-center gap-5">
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative rounded-full p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <Bell aria-hidden className="size-5" />
        </button>
        <UserMenu userName={usuario?.nombre ?? ''} onLogout={handleLogout} />
      </div>
    </header>
  )
}
