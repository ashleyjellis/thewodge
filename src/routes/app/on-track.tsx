import { createFileRoute } from '@tanstack/react-router'
import { useHousehold } from '@/state/household'
import { money, percent, years as yrs } from '@/lib/format'
import { AppScreen } from '@/components/AppScreen'
import { Card, HeroFigure, Muted, SectionHeading, Eyebrow, Closer } from '@/components/brand'
import { StatRow } from '@/components/StatRow'
import { ProgressBar } from '@/components/charts'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { STEPS } from '@/lib/appNav'
import type { CoastFiStatus } from '@/lib/calc/fi'

export const Route = createFileRoute('/app/on-track')({
  component: OnTrack,
})

function coastStatusText(c: CoastFiStatus): string {
  if (c.coasting) return 'self-sustaining'
  if (c.yearsToCoast !== null) return `${yrs(c.yearsToCoast)} to coast`
  return `${percent(c.progress)} of the way`
}

function OnTrack() {
  const { household, analysis } = useHousehold()
  const c = analysis.combined.coast
  const fi = analysis.fi

  return (
    <AppScreen
      stepIndex={1}
      next={{ to: STEPS[2]!.path, label: 'What’s the machine doing? →' }}
    >
      <Card>
        <Eyebrow>coast fi — your investments combined</Eyebrow>
        {c.coasting ? (
          <>
            <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">
              Already self-sustaining.
            </h2>
            <Muted className="mt-2">
              You could stop adding today and still reach your number by{' '}
              {household.retirementAge}. The pension worry is over — this is where
              you get to put it down.
            </Muted>
          </>
        ) : c.yearsToCoast !== null ? (
          <>
            <HeroFigure className="mt-3">{yrs(c.yearsToCoast)}</HeroFigure>
            <Muted className="mt-2">
              from Coast FI — the point you could stop contributing and the market
              alone would carry you to your number.
            </Muted>
          </>
        ) : (
          <>
            <HeroFigure className="mt-3">{percent(c.progress)}</HeroFigure>
            <Muted className="mt-2">
              of the way to Coast FI on today’s pots. Still building — the next
              screen shows how much of that is already the market’s job.
            </Muted>
          </>
        )}

        <ProgressBar
          className="mt-6"
          value={c.currentValue}
          max={c.coastNumber}
        />
        <div className="mt-3 flex items-baseline justify-between text-[13px] text-muted-foreground">
          <span className="tabular-nums">{money(c.currentValue)} today</span>
          <span className="tabular-nums">
            {money(c.coastNumber)} needed to coast
          </span>
        </div>

        <HowWeWorkedThisOut className="mt-6">
          <Working
            formula="Coast FI = the FI number discounted back over the years to retirement, at your real return."
            numbers={`${money(fi)} ÷ (1 + ${percent(household.assumptions.realReturn)})^${analysis.horizon} = ${money(c.coastNumber)}`}
          />
          <p>
            If your invested pots already clear that, they’ll grow into your full
            number by {household.retirementAge} with no more contributions.
          </p>
        </HowWeWorkedThisOut>
      </Card>

      <Card>
        <SectionHeading>Pot by pot</SectionHeading>
        <Muted className="mt-2">
          The pension is the one to watch — locked away, on autopilot, quietly
          compounding.
        </Muted>
        <div className="mt-5 space-y-3">
          {household.people.map((p, i) => {
            const person = analysis.people[i]!
            return (
              <StatRow
                key={`pension-${i}`}
                tone="you"
                label={`${p.name}’s pension`}
                value={coastStatusText(person.pension.coast)}
                sub={money(person.pension.value)}
              />
            )
          })}
          {household.people.map((p, i) => {
            const person = analysis.people[i]!
            return (
              <StatRow
                key={`stocks-${i}`}
                tone="market"
                label={`${p.name}’s investments`}
                value={coastStatusText(person.stocks.coast)}
                sub={money(person.stocks.value)}
              />
            )
          })}
        </div>
        {analysis.people.some((p) => p.pension.coast.coasting) ? (
          <Closer className="mt-5 text-muted-foreground">
            Most of the heavy lifting isn’t yours to do.
          </Closer>
        ) : null}
      </Card>
    </AppScreen>
  )
}
