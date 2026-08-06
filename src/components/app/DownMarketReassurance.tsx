/**
 * Shown instead of the ambient subtitle when actual has dipped below plan
 * but still clears the down-years stress test's Low band (todayState.ts) —
 * the concrete tie-in between the down-years engine and reassurance: real
 * numbers backing "this was already in the range we planned for," not a
 * generic platitude. Plain text, no colour coding — this app never shows a
 * red/alarm state, reassuring or otherwise.
 */
export function DownMarketReassurance({ crossoverYear }: { crossoverYear: number | null }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <h3 className="text-[15px] font-semibold tracking-tight">Markets are down right now</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Your actual total has dipped below plan — but it's still within the range we stress-tested
        for (see the down-years band on Plan).
        {crossoverYear ? ` Growth still overtakes what you put in from ${crossoverYear}.` : ''}
      </p>
    </div>
  )
}
