import { createFileRoute } from '@tanstack/react-router'
import { useHousehold } from '@/state/household'
import { money, multiple, years as yrs } from '@/lib/format'
import { AppScreen } from '@/components/AppScreen'
import { Card, HeroFigure, Muted, Eyebrow, Closer } from '@/components/brand'
import { StatRow } from '@/components/StatRow'
import { StackedAreaChart, type AreaPoint } from '@/components/charts'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { EducationCard } from '@/components/EducationCard'
import { STEPS } from '@/lib/appNav'

export const Route = createFileRoute('/app/the-machine')({
  component: TheMachine,
})

function TheMachine() {
  const { household, analysis, baseYear } = useHousehold()
  const { projection, investableToday, crossover, deployed } = analysis.combined

  const points: AreaPoint[] = projection.map((pt) => ({
    you: investableToday + pt.cumulativeContribution,
    market: pt.cumulativeGrowth,
  }))

  const endYear = baseYear + analysis.horizon

  return (
    <AppScreen
      stepIndex={2}
      next={{ to: STEPS[3]!.path, label: 'What does my future look like? →' }}
    >
      <Card>
        <Eyebrow>you vs the market, over time</Eyebrow>
        {crossover.year !== null && crossover.year > 0 ? (
          <>
            <HeroFigure className="mt-3">{crossover.calendarYear}</HeroFigure>
            <Muted className="mt-2">
              the year the market starts adding more each year than you do — about{' '}
              {yrs(crossover.year)} away. After that, the machine is the bigger
              contributor.
            </Muted>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
              The market is already the bigger contributor.
            </h2>
            <Muted className="mt-2">
              Each year, growth on what you hold now adds more than your
              contributions do.
            </Muted>
          </>
        )}

        <div className="mt-6">
          <StackedAreaChart
            points={points}
            markerIndex={crossover.year}
            markerLabel={
              crossover.calendarYear ? `crossover ${crossover.calendarYear}` : undefined
            }
            startLabel={String(baseYear)}
            endLabel={String(endYear)}
          />
        </div>

        <div className="mt-5 space-y-3">
          <StatRow
            tone="you"
            label="What you put in, by retirement"
            value={money(deployed.deployed + investableToday)}
          />
          <StatRow
            tone="market"
            label="What the market adds, free"
            value={money(deployed.generated)}
          />
        </div>

        <HowWeWorkedThisOut className="mt-6">
          <Working
            formula="Crossover = the first year the market’s growth on the pot is larger than the year’s contributions."
            numbers={
              crossover.year !== null
                ? `year ${crossover.year} (${crossover.calendarYear}): growth ${money(
                    crossover.growthAtCrossover ?? 0,
                  )} > contributions ${money(crossover.contributionAtCrossover ?? 0)}`
                : 'contributions stay ahead across the whole horizon'
            }
          />
          <Working
            formula="Free money = final pot − everything you deployed − what you started with."
            numbers={`${money(deployed.finalValue)} − ${money(deployed.deployed)} − ${money(investableToday)} = ${money(deployed.generated)}  (${multiple(deployed.multiple)} on what you put in)`}
          />
        </HowWeWorkedThisOut>
      </Card>

      <EducationCard household={household} />

      <Closer className="px-1 text-muted-foreground">
        The job is temporary. The machine is permanent.
      </Closer>
    </AppScreen>
  )
}
