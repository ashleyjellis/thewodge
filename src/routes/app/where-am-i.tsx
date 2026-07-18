import { createFileRoute } from '@tanstack/react-router'
import { useHousehold } from '@/state/household'
import { benchmarkMultiple, BENCHMARK_SOURCE } from '@/lib/benchmarks'
import { money, multiple, percent } from '@/lib/format'
import { AppScreen } from '@/components/AppScreen'
import { Card, HeroFigure, Muted, SectionHeading, Eyebrow } from '@/components/brand'
import { StatRow } from '@/components/StatRow'
import { StackedBar } from '@/components/StackedBar'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { STEPS } from '@/lib/appNav'

export const Route = createFileRoute('/app/where-am-i')({
  component: WhereAmI,
})

function WhereAmI() {
  const { household, analysis } = useHousehold()
  const { netWorth } = analysis.combined
  const people = household.people

  return (
    <AppScreen
      stepIndex={0}
      next={{ to: STEPS[1]!.path, label: 'Am I on track? →' }}
    >
      <Card>
        <Eyebrow>net worth today</Eyebrow>
        <HeroFigure className="mt-3">{money(netWorth.total)}</HeroFigure>
        <Muted className="mt-2">
          across three pots{people.length > 1 ? ' and two people' : ''} — kept
          separate on purpose.
        </Muted>

        <StackedBar
          className="mt-6"
          segments={[
            { tone: 'you', value: netWorth.pension, label: 'pension' },
            { tone: 'market', value: netWorth.stocks, label: 'investments' },
            { tone: 'cash', value: netWorth.cash, label: 'cash' },
          ]}
        />

        <div className="mt-5 space-y-3">
          <StatRow
            tone="you"
            label="Pension — locked, on autopilot"
            value={money(netWorth.pension)}
            sub={percent(share(netWorth.pension, netWorth.total))}
          />
          <StatRow
            tone="market"
            label="Investments — the bridge"
            value={money(netWorth.stocks)}
            sub={percent(share(netWorth.stocks, netWorth.total))}
          />
          <StatRow
            tone="cash"
            label="Cash — a different job"
            value={money(netWorth.cash)}
            sub={percent(share(netWorth.cash, netWorth.total))}
          />
        </div>

        <HowWeWorkedThisOut className="mt-6">
          <Working
            formula="Net worth = pension + investments + cash, added across the household."
            numbers={`${money(netWorth.pension)} + ${money(netWorth.stocks)} + ${money(netWorth.cash)} = ${money(netWorth.total)}`}
          />
          <p>
            Most tools blend these into one number and lose the insight. Kept
            apart, each pot has a different job.
          </p>
        </HowWeWorkedThisOut>
      </Card>

      <Card>
        <SectionHeading>Against your age</SectionHeading>
        <Muted className="mt-2">
          The line nobody gives you — where your pension sits next to the median
          for your age.
        </Muted>

        <div className="mt-5 space-y-5">
          {people.map((p, i) => {
            const b = benchmarkMultiple(p.pension.value, p.age)
            return (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-muted-foreground">
                    {p.name}, {p.age} — pension {money(p.pension.value)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[32px] font-semibold tabular-nums tracking-tight">
                    {multiple(b.multiple)}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    the median for their age
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <HowWeWorkedThisOut className="mt-6">
          <Working
            formula="Multiple = your pension ÷ the median private pension for your age band."
            numbers={people
              .map((p) => {
                const b = benchmarkMultiple(p.pension.value, p.age)
                return `${p.name}: ${money(p.pension.value)} ÷ ${money(b.median)} = ${multiple(b.multiple)}`
              })
              .join('  ·  ')}
          />
          <p>
            {BENCHMARK_SOURCE.basis}. Source: {BENCHMARK_SOURCE.name}, as of{' '}
            {BENCHMARK_SOURCE.asOf}. {BENCHMARK_SOURCE.note}{' '}
            <a
              href={BENCHMARK_SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ONS ↗
            </a>
          </p>
        </HowWeWorkedThisOut>
      </Card>
    </AppScreen>
  )
}

function share(part: number, total: number): number {
  return total > 0 ? part / total : 0
}
