/**
 * The portfolio series chart.
 *
 * Hand-built SVG, no charting library, same as StackedBar and BandChart — the
 * whole point of this project is actual numbers, never a black-box
 * visualisation. Coordinate maths lives in exported pure functions so it can
 * be tested directly, since there is no React Testing Library here.
 *
 * Three things this chart does that a default line chart would not, each
 * because the honesty of the record depends on it:
 *
 * 1. **Observation ticks.** A mark at every reading a human actually took, so
 *    the line never implies continuous data. Twelve readings drawn as a
 *    smooth curve looks like a live feed; it is twelve points and a lot of
 *    ink between them.
 * 2. **Forward-filled stretches are drawn differently.** Where a reading is
 *    missing the price is carried forward, and that segment is dashed and
 *    lighter. A gap should read as a gap rather than be smoothed into a trend
 *    nobody observed.
 * 3. **The drawdown band is shaded**, from the peak to the recovery, with the
 *    old high ruled across it. The fall is the number people most want and
 *    almost nobody publishes, so it is drawn rather than described.
 *
 * Colour follows viz.ts's locked semantics — navy for the line, accent for
 * the band. No red: a fall is information, not an alarm, and the copy carries
 * the weight instead.
 */
import { cn } from '@/lib/cn'
import { svgFill } from '@/components/viz'
import type { SeriesPoint } from '@/lib/tracker/types'

export const CHART_WIDTH = 820
export const CHART_HEIGHT = 300
const PLOT_TOP = 16
const PLOT_BOTTOM = 250
const PLOT_LEFT = 8
const PLOT_RIGHT = 812

export type Bounds = { min: number; max: number }

/** The y-axis range, padded so the line never touches the frame. */
export function priceBounds(points: SeriesPoint[]): Bounds {
  if (points.length === 0) return { min: 0, max: 1 }
  const prices = points.map((p) => p.unitPriceMicro)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return { min: min - 1000, max: max + 1000 }
  const padding = (max - min) * 0.12
  return { min: min - padding, max: max + padding }
}

export function xForIndex(index: number, count: number): number {
  if (count <= 1) return (PLOT_LEFT + PLOT_RIGHT) / 2
  return PLOT_LEFT + ((PLOT_RIGHT - PLOT_LEFT) * index) / (count - 1)
}

export function yForPrice(priceMicro: number, bounds: Bounds): number {
  const span = bounds.max - bounds.min
  if (span <= 0) return (PLOT_TOP + PLOT_BOTTOM) / 2
  return PLOT_BOTTOM - ((priceMicro - bounds.min) / span) * (PLOT_BOTTOM - PLOT_TOP)
}

/**
 * Splits the series into runs that are entirely observed or entirely
 * forward-filled, so each can be stroked differently. Runs overlap by one
 * point so the line stays visually continuous across the join.
 */
export function segmentRuns(points: SeriesPoint[]): { filled: boolean; from: number; to: number }[] {
  if (points.length < 2) return []
  const runs: { filled: boolean; from: number; to: number }[] = []
  let start = 0
  let filled = points[1]!.isForwardFilled

  for (let i = 2; i < points.length; i++) {
    const thisFilled = points[i]!.isForwardFilled
    if (thisFilled !== filled) {
      runs.push({ filled, from: start, to: i - 1 })
      start = i - 1
      filled = thisFilled
    }
  }
  runs.push({ filled, from: start, to: points.length - 1 })
  return runs
}

function path(points: SeriesPoint[], from: number, to: number, bounds: Bounds): string {
  const count = points.length
  const parts: string[] = []
  for (let i = from; i <= to; i++) {
    const x = xForIndex(i, count).toFixed(1)
    const y = yForPrice(points[i]!.unitPriceMicro, bounds).toFixed(1)
    parts.push(`${i === from ? 'M' : 'L'}${x} ${y}`)
  }
  return parts.join(' ')
}

export function SeriesChart({
  points,
  peakDate,
  troughDate,
  recoveryDate,
  className,
  ariaLabel,
}: {
  points: SeriesPoint[]
  peakDate?: string | null
  troughDate?: string | null
  recoveryDate?: string | null
  className?: string
  ariaLabel: string
}) {
  if (points.length < 2) return null

  const bounds = priceBounds(points)
  const count = points.length
  const indexOf = (date?: string | null) =>
    date ? points.findIndex((p) => p.onDate === date) : -1

  const peakIndex = indexOf(peakDate)
  const troughIndex = indexOf(troughDate)
  const recoveryIndex = indexOf(recoveryDate)
  // Still under water: shade to the end of what we have, rather than not at all.
  const bandEnd = recoveryIndex >= 0 ? recoveryIndex : troughIndex >= 0 ? count - 1 : -1

  const openingY = yForPrice(points[0]!.unitPriceMicro, bounds)

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className={cn('block h-auto w-full overflow-visible', className)}
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 1, 2, 3].map((step) => {
        const y = PLOT_TOP + ((PLOT_BOTTOM - PLOT_TOP) * step) / 3
        return (
          <line
            key={step}
            x1={PLOT_LEFT}
            y1={y}
            x2={PLOT_RIGHT}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        )
      })}

      {peakIndex >= 0 && bandEnd > peakIndex ? (
        <>
          <rect
            x={xForIndex(peakIndex, count)}
            y={PLOT_TOP}
            width={xForIndex(bandEnd, count) - xForIndex(peakIndex, count)}
            height={PLOT_BOTTOM - PLOT_TOP}
            fill={svgFill.market}
            opacity={0.35}
          />
          <line
            x1={xForIndex(peakIndex, count)}
            y1={yForPrice(points[peakIndex]!.unitPriceMicro, bounds)}
            x2={xForIndex(bandEnd, count)}
            y2={yForPrice(points[peakIndex]!.unitPriceMicro, bounds)}
            stroke="var(--color-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        </>
      ) : null}

      <line
        x1={PLOT_LEFT}
        y1={openingY}
        x2={PLOT_RIGHT}
        y2={openingY}
        stroke="var(--color-muted-foreground)"
        strokeWidth={1}
        strokeDasharray="2 4"
        opacity={0.6}
      />
      <text
        x={PLOT_LEFT}
        y={openingY - 7}
        fontSize={11}
        fill="var(--color-muted-foreground)"
      >
        started here
      </text>

      {segmentRuns(points).map((run, index) => (
        <path
          key={index}
          d={path(points, run.from, run.to, bounds)}
          fill="none"
          stroke={svgFill.you}
          strokeWidth={2}
          strokeLinejoin="round"
          // A carried-forward stretch is drawn as what it is: no reading was
          // taken, so the line is a placeholder rather than a measurement.
          strokeDasharray={run.filled ? '4 4' : undefined}
          opacity={run.filled ? 0.4 : 1}
        />
      ))}

      {points.map((point, index) =>
        point.isForwardFilled || point.isOpening ? null : (
          <line
            key={point.onDate}
            x1={xForIndex(index, count)}
            y1={yForPrice(point.unitPriceMicro, bounds) - 5}
            x2={xForIndex(index, count)}
            y2={yForPrice(point.unitPriceMicro, bounds) + 5}
            stroke={svgFill.you}
            strokeWidth={1.5}
            opacity={0.85}
          />
        ),
      )}

      {troughIndex >= 0 ? (
        <>
          <circle
            cx={xForIndex(troughIndex, count)}
            cy={yForPrice(points[troughIndex]!.unitPriceMicro, bounds)}
            r={4}
            fill={svgFill.you}
          />
          <text
            x={xForIndex(troughIndex, count)}
            y={yForPrice(points[troughIndex]!.unitPriceMicro, bounds) + 20}
            fontSize={11}
            textAnchor="middle"
            fill="var(--color-muted-foreground)"
          >
            lowest point
          </text>
        </>
      ) : null}

      <text x={PLOT_LEFT} y={CHART_HEIGHT - 8} fontSize={11} fill="var(--color-muted-foreground)">
        {points[0]!.onDate}
      </text>
      <text
        x={PLOT_RIGHT}
        y={CHART_HEIGHT - 8}
        fontSize={11}
        textAnchor="end"
        fill="var(--color-muted-foreground)"
      >
        {points[count - 1]!.onDate}
      </text>
    </svg>
  )
}
