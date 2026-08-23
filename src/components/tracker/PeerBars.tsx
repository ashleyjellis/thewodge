/**
 * Peer comparison bars.
 *
 * Diverging from a zero line rather than scaled by magnitude. That is the
 * whole reason this is its own component: drawing bar width from the absolute
 * value makes a 10% loss look longer than a 6% gain, which is exactly
 * backwards, and in a comparison block the reader is scanning bar lengths
 * rather than reading each number.
 *
 * An average and a spread, never a rank. Over a short run the spread between
 * providers is mostly the market moving, not one manager outperforming
 * another, and a league table would assert otherwise.
 */
import { formatReturn } from '@/lib/tracker/money'
import { cn } from '@/lib/cn'

export type PeerBarRow = { label: string; value: number | null; isSelf: boolean }

export type BarGeometry = { leftPct: number; widthPct: number }

/**
 * Where a bar sits on a scale that always includes zero, so gains extend
 * right of the zero line and losses extend left of it.
 */
export function barGeometry(value: number, min: number, max: number): BarGeometry {
  const domainMin = Math.min(0, min)
  const domainMax = Math.max(0, max)
  const span = domainMax - domainMin
  if (span <= 0) return { leftPct: 0, widthPct: 0 }

  const zero = ((0 - domainMin) / span) * 100
  const point = ((value - domainMin) / span) * 100
  const left = Math.min(zero, point)
  // A minimum width so a near-zero value is still visible as a mark rather
  // than vanishing entirely.
  const width = Math.max(Math.abs(point - zero), 0.6)
  return { leftPct: left, widthPct: width }
}

export function zeroLinePct(min: number, max: number): number {
  const domainMin = Math.min(0, min)
  const domainMax = Math.max(0, max)
  const span = domainMax - domainMin
  if (span <= 0) return 0
  return ((0 - domainMin) / span) * 100
}

export function PeerBars({
  rows,
  min,
  max,
}: {
  rows: PeerBarRow[]
  min: number
  max: number
}) {
  const zero = zeroLinePct(min, max)

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const geometry = row.value === null ? null : barGeometry(row.value, min, max)
        return (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(110px,180px)_1fr_80px] items-center gap-4"
          >
            <span
              className={cn(
                'text-[14px]',
                row.isSelf ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {row.label}
            </span>
            <span className="relative block h-5 overflow-hidden rounded-sm border border-border bg-card">
              {/* the zero line, so a bar's direction is readable at a glance */}
              <span
                className="absolute top-0 h-full border-l border-border"
                style={{ left: `${zero}%` }}
                aria-hidden
              />
              {geometry ? (
                <span
                  className={cn(
                    'absolute top-0 h-full',
                    // Direction has to be legible without reading the number
                    // beside it. The geometry already puts a loss left of the
                    // zero line, but a loss and a gain drawn in one fill are
                    // told apart only by which side of a hairline they start
                    // on — which is not a difference anyone registers while
                    // scanning. A negative bar is outlined rather than solid,
                    // so it reads as absence against the solid gains.
                    row.value !== null && row.value < 0
                      ? 'border border-foreground/45 bg-foreground/10'
                      : row.isSelf
                        ? 'bg-foreground'
                        : 'bg-accent',
                  )}
                  style={{ left: `${geometry.leftPct}%`, width: `${geometry.widthPct}%` }}
                />
              ) : null}
            </span>
            <span className="text-right text-[13px] tabular-nums text-foreground">
              {row.value === null ? '—' : formatReturn(row.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
