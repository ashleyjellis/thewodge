import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useHousehold } from '@/state/household'
import { analyseHousehold } from '@/lib/calc/household'
import type { Snapshot } from '@/lib/calc/types'
import { money } from '@/lib/format'
import { AppScreen } from '@/components/AppScreen'
import { Card, HeroFigure, Muted, Eyebrow, SectionHeading, Closer } from '@/components/brand'
import { PrimaryButton } from '@/components/PrimaryButton'
import { LineChart, type LineSeries } from '@/components/charts'
import { DownMarketNote } from '@/components/DownMarketNote'
import { STEPS } from '@/lib/appNav'
import { cn } from '@/lib/cn'

export const Route = createFileRoute('/app/track')({
  component: Track,
})

function netWorthOf(s: Snapshot): number {
  return analyseHousehold(s.state).combined.netWorth.total
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}

function Track() {
  const {
    analysis,
    snapshots,
    actuals,
    baseline,
    saveBaseline,
    addActual,
    replan,
  } = useHousehold()

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const currentNetWorth = analysis.combined.netWorth.total

  // baselines other than the plan-of-record — the faded forks after a replan
  const oldBaselines = useMemo(
    () => snapshots.filter((s) => s.type === 'baseline' && s.id !== baseline?.id),
    [snapshots, baseline],
  )

  const chart = useMemo(() => {
    if (!baseline || actuals.length === 0) return null
    const baseAnalysis = analyseHousehold(baseline.state)
    const offset =
      baseAnalysis.combined.netWorth.total - baseAnalysis.combined.investableToday
    const proj = baseAnalysis.combined.projection
    const baseTime = new Date(baseline.timestamp).getTime()
    const yearMs = 365.25 * 24 * 3600 * 1000

    const planPoints: number[] = []
    const actualPoints: number[] = []
    const labels: string[] = []
    for (const a of actuals) {
      const elapsed = Math.max(
        0,
        Math.min(proj.length - 1, Math.round((new Date(a.timestamp).getTime() - baseTime) / yearMs)),
      )
      planPoints.push(proj[elapsed]!.endValue + offset)
      actualPoints.push(netWorthOf(a))
      labels.push(shortDate(a.timestamp))
    }

    const series: LineSeries[] = [
      { points: planPoints, tone: 'market' },
      { points: actualPoints, tone: 'you' },
    ]
    for (const ob of oldBaselines) {
      const obAnalysis = analyseHousehold(ob.state)
      const obOffset =
        obAnalysis.combined.netWorth.total - obAnalysis.combined.investableToday
      series.push({
        points: actuals.map((_, i) => obAnalysis.combined.projection[Math.min(i, obAnalysis.combined.projection.length - 1)]!.endValue + obOffset),
        tone: 'market',
        faded: true,
        dashed: true,
      })
    }
    return { series, labels, planPoints, actualPoints }
  }, [baseline, actuals, oldBaselines])

  const ahead =
    chart && chart.actualPoints.length > 0
      ? chart.actualPoints[chart.actualPoints.length - 1]! >=
        chart.planPoints[chart.planPoints.length - 1]!
      : true

  const droppedThisTime =
    actuals.length >= 2 &&
    netWorthOf(actuals[actuals.length - 1]!) < netWorthOf(actuals[actuals.length - 2]!)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppScreen stepIndex={null} backTo={STEPS[4]!.path}>
      <div>
        <Eyebrow>tracking</Eyebrow>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">
          Reality against your plan.
        </h1>
      </div>

      {!baseline ? (
        <Card>
          <SectionHeading>Set your baseline</SectionHeading>
          <Muted className="mt-2">
            Save today’s numbers as your plan of record. It won’t move again unless
            you deliberately re-plan — so progress stays visible.
          </Muted>
          <div className="mt-5">
            <HeroFigure>{money(currentNetWorth)}</HeroFigure>
            <Muted className="mt-1">net worth today</Muted>
          </div>
          <div className="mt-6">
            <PrimaryButton
              disabled={busy}
              onClick={() => run(() => saveBaseline('Baseline set'))}
            >
              Make this my baseline
            </PrimaryButton>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <Eyebrow>{ahead ? 'ahead of plan' : 'tracking to a revised plan'}</Eyebrow>
            <HeroFigure className="mt-3">{money(currentNetWorth)}</HeroFigure>
            <Muted className="mt-2">
              net worth today, against the {money(netWorthOf(baseline))} your
              baseline started from.
            </Muted>
            {chart ? (
              <div className="mt-6">
                <LineChart series={chart.series} labels={chart.labels} />
                <div className="mt-3 flex items-center gap-4 text-[12px] text-muted-foreground">
                  <Legend tone="you" label="your actuals" />
                  <Legend tone="market" label="baseline plan" />
                  {oldBaselines.length > 0 ? (
                    <Legend tone="market" label="old baseline" faded />
                  ) : null}
                </div>
              </div>
            ) : (
              <Muted className="mt-4">
                Record today’s numbers below to start the line.
              </Muted>
            )}
          </Card>

          {droppedThisTime ? <DownMarketNote yearsOfBuying={analysis.horizon} /> : null}

          <Card>
            <SectionHeading>Record today’s numbers</SectionHeading>
            <Muted className="mt-2">
              Update your positions on the earlier screens, then capture them here
              with a note. Every update is kept — it becomes your financial diary.
            </Muted>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. bonus invested, pulled £5k for the wedding"
              className="mt-4 w-full rounded-2xl bg-muted px-4 py-3 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:bg-accent/40"
            />
            <div className="mt-4 space-y-2">
              <PrimaryButton
                disabled={busy}
                onClick={() => run(() => addActual(note || 'Update'))}
              >
                Record today’s numbers
              </PrimaryButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => replan(note || 'Re-planned'))}
                className="block w-full rounded-full px-6 py-3 text-center text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                Make this my new plan
              </button>
            </div>
            <Muted className="mt-3 text-[12px]">
              Re-planning is deliberate. Your old baseline stays visible as a faded
              line — a dip becomes “you re-based here”, never “you failed”.
            </Muted>
          </Card>

          {snapshots.length > 0 ? (
            <Card>
              <SectionHeading>Your diary</SectionHeading>
              <div className="mt-4 space-y-2">
                {[...snapshots].reverse().map((s) => (
                  <div
                    key={s.id}
                    className="flex items-baseline justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[10px] font-medium uppercase tracking-[0.14em]',
                            s.id === baseline?.id
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {s.id === baseline?.id
                            ? 'baseline'
                            : s.type === 'baseline'
                              ? 'old baseline'
                              : 'actual'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {shortDate(s.timestamp)}
                        </span>
                      </div>
                      <div className="truncate text-[13px] text-foreground">
                        {s.note || '—'}
                      </div>
                    </div>
                    <div className="shrink-0 text-[13px] font-semibold tabular-nums">
                      {money(netWorthOf(s))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Closer className="px-1 text-muted-foreground">
            Actuals move freely. The baseline only moves when you say so.
          </Closer>
        </>
      )}
    </AppScreen>
  )
}

function Legend({
  tone,
  label,
  faded,
}: {
  tone: 'you' | 'market'
  label: string
  faded?: boolean
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          tone === 'you' ? 'bg-foreground' : 'bg-accent',
          faded ? 'opacity-40' : undefined,
        )}
      />
      {label}
    </span>
  )
}
