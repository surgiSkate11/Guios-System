import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle: string
  icon: LucideIcon
  actions?: ReactNode
}

/** Page title block of the prototypes: icon tile, title, subtitle and optional actions. */
export function PageHeader({ title, subtitle, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Icon aria-hidden className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-0.5 text-slate-500">{subtitle}</p>
        </div>
      </div>
      {actions}
    </div>
  )
}
