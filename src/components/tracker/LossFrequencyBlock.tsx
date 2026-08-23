/**
 * How often it falls, beside how far it fell.
 *
 * The drawdown callout says the worst of it. This says how ordinary a bad
 * week is — and for most people that is the more useful of the two, because
 * the fear is rarely the single worst week. It is that a fall means something
 * has gone wrong. A portfolio that is up over the run and still fell in two
 * weeks out of five answers that better than any amount of copy.
 *
 * Nothing here is a signal to act on. It counts weeks.
 */
import type { LossFrequency } from '@/lib/tracker/lossFrequency'
import { MIN_WEEKS_FOR_FREQUENCY, SHARP_FALL_THRESHOLD } from '@/lib/tracker/lossFrequency'

function Figure({ value, caption }: { value: string; caption: string }) {
  return (
    <div>
      <p className="text-[26px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 max-w-[22ch] text-[13px] leading-snug text-muted-foreground">{caption}</p>
    </div>
  )
}

export function LossFrequencyBlock({ frequency }: { frequency: LossFrequency }) {
  if (!frequency.isSufficient) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-[15px] font-medium text-foreground">
          {frequency.observedWeeks} week{frequency.observedWeeks === 1 ? '' : 's'} observed so far.
        </p>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
          How often a portfolio falls needs at least {MIN_WEEKS_FOR_FREQUENCY} weeks before the
          proportion means anything — below that, one bad week swings it by ten points. It appears
          here as the series grows.
        </p>
      </div>
    )
  }

  const downShare = frequency.weeksDown! / frequency.observedWeeks

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-x-12 gap-y-8 rounded-2xl border border-border bg-card p-6">
        <Figure
          value={`${frequency.weeksDown} of ${frequency.observedWeeks}`}
          caption={`weeks ended lower than the week before — ${Math.round(downShare * 100)}% of them`}
        />
        <Figure
          value={`${frequency.longestDownRun}`}
          caption={`week${frequency.longestDownRun === 1 ? '' : 's'} in a row was the longest unbroken run of falls`}
        />
        <Figure
          value={`${Math.round(frequency.sharpFallShare! * 100)}%`}
          caption={`of weeks fell by more than ${(SHARP_FALL_THRESHOLD * 100).toFixed(0)}%`}
        />
      </div>
      <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
        Falls are frequent and mostly unremarkable. The figure above the chart tells you how bad
        the worst of it got; these tell you how routine the bad weeks are. A portfolio that only
        ever rose would be the surprising one.
      </p>
    </div>
  )
}
