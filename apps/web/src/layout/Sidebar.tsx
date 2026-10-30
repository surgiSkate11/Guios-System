import { ChevronDown, FileText } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Brand } from '../components/Brand'
import { NAVIGATION, isNavGroup, type NavGroupItem, type NavLinkItem } from '../navigation'

const itemBase =
  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600'
const itemIdle = 'text-slate-700 hover:bg-slate-100'
const itemActive = 'bg-brand-50 text-brand-700'

function SidebarLink({ item }: { item: NavLinkItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemIdle}`}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      {item.label}
    </NavLink>
  )
}

function SidebarGroup({ item }: { item: NavGroupItem }) {
  const { pathname } = useLocation()
  const inGroup = item.matches.some((prefix) => pathname.startsWith(prefix))
  const [open, setOpen] = useState(inGroup)
  const [wasInGroup, setWasInGroup] = useState(inGroup)
  const Icon = item.icon
  const listId = `nav-group-${item.label}`

  // Entering a page of the group from elsewhere expands it (state adjusted during render).
  if (inGroup !== wasInGroup) {
    setWasInGroup(inGroup)
    if (inGroup) setOpen(true)
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={`${itemBase} w-full ${inGroup ? itemActive : itemIdle}`}
      >
        <Icon aria-hidden className="size-5 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          aria-hidden
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul id={listId} className="mt-1 space-y-0.5 pl-4">
          {item.children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end
                className={({ isActive }) =>
                  `block rounded-md px-4 py-2 text-[13px] transition-colors ${
                    isActive
                      ? 'border-l-2 border-brand-600 bg-brand-50 font-semibold text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-5">
      <Brand />
      <nav aria-label="Navegación principal" className="mt-6 flex-1 space-y-1">
        {NAVIGATION.map((item) =>
          isNavGroup(item) ? (
            <SidebarGroup key={item.label} item={item} />
          ) : (
            <SidebarLink key={item.to} item={item} />
          ),
        )}
      </nav>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-600">
        <FileText aria-hidden className="size-5 shrink-0 text-blue-600" />
        Sistema de evaluación de software con evidencia
      </div>
    </aside>
  )
}
