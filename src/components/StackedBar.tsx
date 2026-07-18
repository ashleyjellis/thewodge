/**
 * Stacked bar (brand guide §6): a single h-7 rounded-full track with flex children
 * sized by percentage. No labels inside the bar — the legend rows underneath (built
 * from StatRow) carry the meaning.
 */
import { cn } from '@/lib/cn'
import { fillClass, type Tone } from './viz'

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
            return (
              <div
                key={i}
                className={cn('h-full', fillClass[seg.tone])}
                style={{ width: `${width}%` }}
              />
            )
          })
        : null}
    </div>
  )
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((Math.max(0, value) / total) * 100) : 0
}
