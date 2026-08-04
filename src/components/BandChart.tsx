/**
 * A hand-built range-band chart (spec: down-years sequence-of-returns
 * modelling) — the shaded region between a low and high projection, with a
 * mid-line through it. Zero-dependency SVG, no charting library — this
 * app's whole ethos is actual formula, actual numbers, never a black-box
 * visualisation (see /methodology). Uses viz.ts's locked tone semantics:
 * mid = "you" navy, band = "market" light blue at reduced opacity — never
 * a hardcoded hex. Fixed internal viewBox, scaled responsively via CSS, so
 * the coordinate math never needs to know the real rendered pixel size.
 *
 * Deliberately domain-agnostic (no knowledge of scheduledPlan.ts/
 * planBand.ts) — a BandPoint is just a label plus three numbers, so this
 * stays as reusable as StackedBar.tsx.
 *
 * No React Testing Library exists in this repo, so this component leans on
 * browser-screenshot verification; the coordinate math below is instead
 * extracted into small, pure, exported functions covered directly by
 * vitest — the same "pull the maths out so it's testable" instinct as
 * StackedBar.tsx's own pct() helper, just made testable since this
 * component can't be.
 */
import { cn } from '@/lib/cn'
import { svgFill } from './viz'

export type BandPoint = {
  /** x-axis label — e.g. a calendar year, as a string so this component
   *  never needs to know what x actually represents */
  x: string
  low: number
  mid: number
  high: number
}

export const CHART_WIDTH = 600
export const CHART_HEIGHT = 220
const AXIS_HEIGHT = 24
export const PLOT_HEIGHT = CHART_HEIGHT - AXIS_HEIGHT

/** Horizontal position for the nth of `count` evenly-spaced points, across
 *  the full chart width. A single point sits centred rather than dividing
 *  by zero. */
export function xForIndex(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2
  return (index / (count - 1)) * width
}

/** The lowest and highest value across every point's low/mid/high — the
 *  y-axis has to span all three series, not just whichever is plotted. */
export function valueRange(points: BandPoint[]): { min: number; max: number } {
  if (points.length === 0) return { min: 0, max: 0 }
  const values = points.flatMap((p) => [p.low, p.mid, p.high])
  return { min: Math.min(...values), max: Math.max(...values) }
}

/** Vertical position for a value within [min, max], inverted (SVG y grows
 *  downward, so the highest value maps to the smallest y). A flat series
 *  (min === max) sits on a centred horizontal line rather than dividing by
 *  zero. */
export function yForValue(value: number, min: number, max: number, height: number): number {
  if (max <= min) return height / 2
  const t = (value - min) / (max - min)
  return height - t * height
}

/** The closed band polygon: the high line left-to-right, then the low line
 *  back right-to-left, so the fill covers everything between them. */
export function bandPath(points: BandPoint[], min: number, max: number, width: number, height: number): string {
  if (points.length === 0) return ''
  const count = points.length
  const top = points.map((p, i) => `${xForIndex(i, count, width)},${yForValue(p.high, min, max, height)}`)
  const bottom = points
    .map((p, i) => `${xForIndex(i, count, width)},${yForValue(p.low, min, max, height)}`)
    .reverse()
  return `M ${top.join(' L ')} L ${bottom.join(' L ')} Z`
}

/** The mid-line's own path — open, not closed, and never filled. */
export function midLinePath(points: BandPoint[], min: number, max: number, width: number, height: number): string {
  if (points.length === 0) return ''
  const count = points.length
  const coords = points.map((p, i) => `${xForIndex(i, count, width)},${yForValue(p.mid, min, max, height)}`)
  return `M ${coords.join(' L ')}`
}

/** A handful of evenly-spaced label indices — never every point, or a
 *  multi-decade horizon would overlap into an illegible smear at mobile
 *  width. Always includes the first and last point. */
export function xAxisLabelIndices(count: number, maxLabels: number): number[] {
  if (count <= 0) return []
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i)
  const indices = Array.from({ length: maxLabels }, (_, i) => Math.round((i / (maxLabels - 1)) * (count - 1)))
  return [...new Set(indices)]
}

export function BandChart({ points, className }: { points: BandPoint[]; className?: string }) {
  if (points.length === 0) return null

  const { min, max } = valueRange(points)
  const band = bandPath(points, min, max, CHART_WIDTH, PLOT_HEIGHT)
  const mid = midLinePath(points, min, max, CHART_WIDTH, PLOT_HEIGHT)
  const labelIndices = xAxisLabelIndices(points.length, 5)

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label={`Projected value range, from ${points[0]!.x} to ${points.at(-1)!.x}`}
    >
      <path d={band} fill={svgFill.market} fillOpacity={0.35} stroke="none" />
      <path d={mid} fill="none" stroke={svgFill.you} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {labelIndices.map((i) => {
        const x = xForIndex(i, points.length, CHART_WIDTH)
        const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
        return (
          <text
            key={i}
            x={x}
            y={CHART_HEIGHT - 6}
            textAnchor={anchor}
            fill="currentColor"
            className="text-[10px] text-muted-foreground"
          >
            {points[i]!.x}
          </text>
        )
      })}
    </svg>
  )
}
