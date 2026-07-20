/**
 * The Dashboard's headline module — where you're on track for at a near-term
 * milestone (40) alongside your actual retirement target, computed live from
 * today's accounts (never the frozen Forecast baseline — this is a quick
 * glance, not a plan commitment).
 */
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

export function MilestoneHeadline({
  by40,
  byRetirement,
  retirementAge,
}: {
  /** null when the household's already past 40 — that milestone no longer applies */
  by40: number | null
  byRetirement: number
  retirementAge: number
}) {
  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-10">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        On track
      </p>
      <div className={cn('mt-5 grid gap-8', by40 !== null ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
        {by40 !== null ? (
          <div>
            <p className="text-[15px] leading-snug text-muted-foreground">
              By 40 you’re on track for
            </p>
            <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums sm:text-[48px]">
              {money(by40)}
            </p>
          </div>
        ) : null}
        <div>
          <p className="text-[15px] leading-snug text-muted-foreground">
            By {retirementAge} you’re on track for
          </p>
          <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums sm:text-[48px]">
            {money(byRetirement)}
          </p>
        </div>
      </div>
    </div>
  )
}
