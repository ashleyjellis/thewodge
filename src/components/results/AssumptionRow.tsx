/**
 * A locked-assumption row (spec: "product hooks") — visually and behaviourally
 * distinct from the live-editable fields above it. Muted background, no input
 * styling, an "assumed" label and a chevron, so it reads as non-editable before
 * you even touch it. Opens the shared HookModal rather than dead-ending.
 */
import { ChevronRight } from 'lucide-react'

export function AssumptionRow({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-muted px-4 py-3.5 text-left transition-colors hover:bg-muted/70"
    >
      <span className="min-w-0">
        <span className="block text-[13px] text-foreground">{label}</span>
        <span className="block text-[12px] text-muted-foreground">{value}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          assumed
        </span>
        <ChevronRight size={16} strokeWidth={2.25} className="text-muted-foreground" />
      </span>
    </button>
  )
}
