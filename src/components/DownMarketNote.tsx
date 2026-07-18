/**
 * Down-market reassurance (spec §7 — the behavioural guardrail; do not cut).
 * When actuals show a drop, surface a quiet, non-gamified note in brand voice: no
 * urgency, no emoji, no nudge to trade. Understated. The caller decides when a drop
 * has happened; this just says the calm thing well.
 */
import { Closer } from './brand'

export function DownMarketNote({
  yearsOfBuying,
}: {
  /** roughly how many years the household is still a net buyer */
  yearsOfBuying?: number
}) {
  return (
    <div className="rounded-3xl bg-accent/40 p-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        a lower month
      </p>
      <Closer className="mt-3 text-foreground">
        {yearsOfBuying && yearsOfBuying > 0
          ? `you’re a net buyer for ${yearsOfBuying} more years yet — lower prices buy more. this is the plan working, not failing.`
          : 'you’re a net buyer for years yet — lower prices buy more. this is the plan working, not failing.'}
      </Closer>
    </div>
  )
}
