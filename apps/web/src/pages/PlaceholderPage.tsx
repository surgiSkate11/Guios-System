import { Construction, type LucideIcon } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'

export interface PlaceholderPageProps {
  title: string
  subtitle: string
  icon: LucideIcon
  /** Requirements this screen will cover, e.g. "RF-02, HU-01". */
  covers: string
}

/** Base screen for a module that is not built yet. */
export function PlaceholderPage({ title, subtitle, icon, covers }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} icon={icon} />
      <section className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-16 text-center">
        <Construction aria-hidden className="size-10 text-amber-500" />
        <p className="text-lg font-semibold text-slate-800">Módulo en construcción</p>
        <p className="max-w-md text-sm text-slate-500">
          Esta pantalla se desarrollará en una próxima etapa. Cubrirá: {covers}.
        </p>
      </section>
    </>
  )
}
