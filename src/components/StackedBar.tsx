/**
 * Stacked bar (brand guide §6): a single h-7 rounded-full track with flex children
 * sized by percentage. A segment over 10% of the total gets its own whole-number
 * percentage label; the legend rows underneath (built from StatRow) carry the
 * rest of the meaning, including for slimmer segments.
 */
import { cn } from '@/lib/cn'
import { fillClass, labelTextClass, type Tone } from './viz'

export type BarSegment = {
  tone: Tone
  value: number
  /** for the aria label / screen readers */
  label?: string
}

export function StackedBar({
  segments,
  className,
}: {
  segments: BarSegment[]
  className?: string
}) {
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0)

  return (
    <div
      className={cn(
        'flex h-7 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
      role="img"
      aria-label={segments
        .map((s) => `${s.label ?? s.tone}: ${pct(s.value, total)}%`)
        .join(', ')}
    >
      {total > 0
        ? segments.map((seg, i) => {
            const width = (Math.max(0, seg.value) / total) * 100
            if (width <= 0) return null
            const p = pct(seg.value, total)
            return (
              <div
                key={i}
                className={cn(
                  'flex h-full items-center justify-center overflow-hidden',
                  fillClass[seg.tone],
                )}
                style={{ width: `${width}%` }}
              >
                {p > 10 ? (
                  <span
                    className={cn(
                      'text-[11px] font-semibold tabular-nums',
                      labelTextClass[seg.tone],
                    )}
                  >
                    {p}%
                  </span>
                ) : null}
              </div>
            )
          })
        : null}
    </div>
  )
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((Math.max(0, value) / total) * 100) : 0
}
