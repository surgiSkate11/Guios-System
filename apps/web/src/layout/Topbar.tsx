import { Bell, ChevronDown, Search } from 'lucide-react'

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function Topbar({ userName }: { userName: string }) {
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
        <button
          type="button"
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
      </div>
    </header>
  )
}
