/**
 * "Add your partner" — a missing capability, not a simplified default, so it gets
 * its own distinct visual treatment (accent tint, an icon, more presence) rather
 * than the muted "assumed" row styling used for locked rate/contribution defaults.
 */
import { ChevronRight, UserPlus } from 'lucide-react'

export function PartnerCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-accent/30 px-5 py-4 text-left transition-colors hover:bg-accent/45"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
        <UserPlus size={18} strokeWidth={2.25} className="text-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-foreground">
          Add your partner
        </span>
        <span className="block text-[12px] text-muted-foreground">
          Most of our readers plan as a household — see how that changes this.
        </span>
      </span>
      <ChevronRight size={16} strokeWidth={2.25} className="shrink-0 text-muted-foreground" />
    </button>
  )
}
