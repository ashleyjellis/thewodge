/**
 * Hand-rolled SVG charts (spec §11: "one calm chart per screen"; brand §8, §9).
 * No dashboard kit. Navy = you, accent = market — never swapped. No entrance
 * animation; numbers appear settled. Fills use theme variables (no hardcoded hex).
 */
import { Fragment } from 'react'
import { cn } from '@/lib/cn'
import { fillClass, svgFill, type Tone } from './viz'

// ── Progress bar (coast FI) ──────────────────────────────────────────────────

export function ProgressBar({
  value,
  max,
  tone = 'you',
  className,
}: {
  value: number
  max: number
  tone?: Tone
  className?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0
  return (
    <div className={cn('h-2.5 w-full rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full', fillClass[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Stacked area (the machine: you vs market over time) ──────────────────────

const W = 340
const H = 184
const PAD = { t: 18, r: 10, b: 26, l: 10 }
const innerW = W - PAD.l - PAD.r
const innerH = H - PAD.t - PAD.b

export type AreaPoint = { you: number; market: number }

export function StackedAreaChart({
  points,
  markerIndex,
  markerLabel,
  startLabel,
  endLabel,
}: {
  points: AreaPoint[]
  markerIndex?: number | null
  markerLabel?: string
  startLabel?: string
  endLabel?: string
}) {
  const n = points.length
  const yMax = Math.max(...points.map((p) => p.you + p.market), 1)
  const xOf = (i: number) =>
    PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const yOf = (v: number) => PAD.t + innerH - (v / yMax) * innerH

  const youArea = bandPath(
    points.map((_, i) => xOf(i)),
    points.map(() => yOf(0)),
    points.map((p) => yOf(p.you)),
  )
  const marketArea = bandPath(
    points.map((_, i) => xOf(i)),
    points.map((p) => yOf(p.you)),
    points.map((p) => yOf(p.you + p.market)),
  )
  const topLine = linePath(
    points.map((_, i) => xOf(i)),
    points.map((p) => yOf(p.you + p.market)),
  )

  const showMarker =
    markerIndex !== null && markerIndex !== undefined && markerIndex >= 0
  const mx = showMarker ? xOf(markerIndex) : 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="h-auto w-full"
      role="img"
      aria-label="Your contributions and market growth over time"
    >
      <path d={youArea} fill={svgFill.you} />
      <path d={marketArea} fill={svgFill.market} />
      <path
        d={topLine}
        fill="none"
        stroke={svgFill.you}
        strokeOpacity={0.25}
        strokeWidth={1.5}
      />
      {showMarker ? (
        <g>
          <line
            x1={mx}
            x2={mx}
            y1={PAD.t - 6}
            y2={PAD.t + innerH}
            stroke={svgFill.you}
            strokeWidth={1}
            strokeDasharray="3 3"
            strokeOpacity={0.45}
          />
          {markerLabel ? (
            <text
              x={Math.min(mx + 4, W - PAD.r)}
              y={PAD.t - 8}
              textAnchor={mx > W / 2 ? 'end' : 'start'}
              fontSize={10}
              fill="var(--color-muted-foreground)"
            >
              {markerLabel}
            </text>
          ) : null}
        </g>
      ) : null}
      {startLabel ? (
        <text
          x={PAD.l}
          y={H - 8}
          fontSize={10}
          fill="var(--color-muted-foreground)"
        >
          {startLabel}
        </text>
      ) : null}
      {endLabel ? (
        <text
          x={W - PAD.r}
          y={H - 8}
          textAnchor="end"
          fontSize={10}
          fill="var(--color-muted-foreground)"
        >
          {endLabel}
        </text>
      ) : null}
    </svg>
  )
}

// ── Line chart (tracking: baseline vs actuals) ───────────────────────────────

export type LineSeries = {
  points: number[]
  tone: Tone
  faded?: boolean
  dashed?: boolean
}

export function LineChart({
  series,
  labels,
}: {
  series: LineSeries[]
  labels?: string[]
}) {
  const maxLen = Math.max(...series.map((s) => s.points.length), 1)
  const yMax = Math.max(
    ...series.flatMap((s) => s.points),
    1,
  )
  const yMin = Math.min(...series.flatMap((s) => s.points), 0)
  const span = yMax - yMin || 1
  const xOf = (i: number) => PAD.l + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * innerW)
  const yOf = (v: number) => PAD.t + innerH - ((v - yMin) / span) * innerH

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="h-auto w-full"
      role="img"
      aria-label="Actual net worth against the baseline plan"
    >
      {series.map((s, si) => (
        <Fragment key={si}>
          <path
            d={linePath(s.points.map((_, i) => xOf(i)), s.points.map((v) => yOf(v)))}
            fill="none"
            stroke={svgFill[s.tone]}
            strokeWidth={2}
            strokeOpacity={s.faded ? 0.3 : 1}
            strokeDasharray={s.dashed ? '4 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {s.points.map((v, i) => (
            <circle
              key={i}
              cx={xOf(i)}
              cy={yOf(v)}
              r={2.5}
              fill={svgFill[s.tone]}
              fillOpacity={s.faded ? 0.3 : 1}
            />
          ))}
        </Fragment>
      ))}
      {labels?.map((label, i) => (
        <text
          key={i}
          x={xOf(i)}
          y={H - 8}
          textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
          fontSize={10}
          fill="var(--color-muted-foreground)"
        >
          {label}
        </text>
      ))}
    </svg>
  )
}

// ── path helpers ─────────────────────────────────────────────────────────────

function linePath(xs: number[], ys: number[]): string {
  return xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(ys[i]!)}`)
    .join(' ')
}

/** filled band between a bottom edge and a top edge sharing x coordinates */
function bandPath(xs: number[], bottom: number[], top: number[]): string {
  if (xs.length === 0) return ''
  const topEdge = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(top[i]!)}`)
    .join(' ')
  const bottomEdge = [...xs]
    .map((x, i) => ({ x, y: bottom[i]! }))
    .reverse()
    .map((p) => `L ${round(p.x)} ${round(p.y)}`)
    .join(' ')
  return `${topEdge} ${bottomEdge} Z`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
