/** GUIOS PRO logo with its tagline, as shown in the prototypes. */
export function Brand({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${centered ? 'flex-col text-center' : ''}`}>
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-lg bg-brand-600 text-lg font-bold text-white"
      >
        G
      </span>
      <div>
        <p className="text-lg leading-tight font-bold text-slate-900">GUIOS PRO</p>
        <p className="text-xs text-slate-500">Evaluación de Software</p>
      </div>
    </div>
  )
}
