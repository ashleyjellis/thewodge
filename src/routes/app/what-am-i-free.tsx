import { createFileRoute } from '@tanstack/react-router'
import { useHousehold } from '@/state/household'
import { householdStopScenario } from '@/lib/calc/household'
import { earliestFiFromSeries } from '@/lib/calc/scenarios'
import { PENSION_ACCESS_AGE } from '@/lib/calc/types'
import { money, percent, years as yrs } from '@/lib/format'
import { AppScreen } from '@/components/AppScreen'
import { Card, HeroFigure, Muted, Eyebrow, Closer, SectionHeading } from '@/components/brand'
import { StatRow } from '@/components/StatRow'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { TRACK_PATH } from '@/lib/appNav'

export const Route = createFileRoute('/app/what-am-i-free')({
  component: WhatAmIFree,
})

function WhatAmIFree() {
  const { household, analysis } = useHousehold()
  const anchorAge = Math.min(...household.people.map((p) => p.age))
  const { swr } = household.assumptions
  const target = household.targetIncomeToday
  const fi = analysis.fi

  const earliest = analysis.combined.earliestFi
  const partTime = earliestFiFromSeries(
    analysis.combined.projection,
    fi / 2,
    anchorAge,
  )

  const sustainableIncome = analysis.combined.investableFinal * swr
  const targetShare = sustainableIncome > 0 ? target / sustainableIncome : 1

  // bridge from an early full-stop to pension access age
  const bridgeStopAge = earliest.age ?? Math.min(50, household.retirementAge - 1)
  const bridge =
    bridgeStopAge < PENSION_ACCESS_AGE
      ? householdStopScenario(household, bridgeStopAge).bridge
      : null

  return (
    <AppScreen
      stepIndex={4}
      next={{ to: TRACK_PATH, label: 'Track it over time →' }}
    >
      <Card>
        <Eyebrow>your earliest realistic freedom</Eyebrow>
        {earliest.age !== null ? (
          <>
            <HeroFigure className="mt-3">{earliest.age}</HeroFigure>
            <Muted className="mt-2">
              the earliest age your invested pots alone would sustain{' '}
              {money(target)} a year at a {percent(swr)} withdrawal — about{' '}
              {yrs(earliest.age - anchorAge)} away. Not a plan. Just what the maths
              allows.
            </Muted>
          </>
        ) : (
          <>
            <HeroFigure className="mt-3">{household.retirementAge}</HeroFigure>
            <Muted className="mt-2">
              your number arrives around {household.retirementAge}. The screens
              before this show how much of that is already the market’s job.
            </Muted>
          </>
        )}
      </Card>

      <Card>
        <SectionHeading>What that buys you</SectionHeading>
        <div className="mt-5 space-y-3">
          {partTime.age !== null && earliest.age !== null && partTime.age < earliest.age ? (
            <StatRow
              tone="you"
              label="Go part-time — cover half from the pot"
              value={`age ${partTime.age}`}
            />
          ) : null}
          {earliest.age !== null ? (
            <StatRow
              tone="you"
              label="Stop working entirely"
              value={`age ${earliest.age}`}
            />
          ) : null}
          {targetShare < 1 ? (
            <StatRow
              tone="market"
              label="Your target vs what the pot throws off"
              value={percent(targetShare)}
              sub={`${money(sustainableIncome)}/yr at ${household.retirementAge}`}
            />
          ) : null}
        </div>

        <HowWeWorkedThisOut className="mt-6">
          <Working
            formula="Earliest freedom = the first year the invested pot reaches your FI number."
            numbers={
              earliest.value !== null
                ? `pot ${money(earliest.value)} ≥ FI ${money(fi)} at age ${earliest.age}`
                : `pot does not reach FI ${money(fi)} before ${household.retirementAge}`
            }
          />
          {targetShare < 1 ? (
            <Working
              formula="Target share = your target income ÷ what the projected pot sustains at the SWR."
              numbers={`${money(target)} ÷ ${money(sustainableIncome)} = ${percent(targetShare)}`}
            />
          ) : null}
        </HowWeWorkedThisOut>
      </Card>

      {bridge ? (
        <Card>
          <SectionHeading>The bridge to your pension</SectionHeading>
          <Muted className="mt-2">
            Stop at {bridgeStopAge} and your pension is still locked until{' '}
            {PENSION_ACCESS_AGE}. Can your investments alone carry those{' '}
            {yrs(bridge.bridgeYears)}?
          </Muted>
          <div className="mt-5 space-y-3">
            <StatRow
              tone="market"
              label="Investments at that age"
              value={money(bridge.potAtStop)}
            />
            <StatRow
              tone="you"
              label={`Needed to bridge to ${PENSION_ACCESS_AGE}`}
              value={money(bridge.requiredPot)}
            />
          </div>
          <Closer className="mt-5 text-foreground">
            {bridge.covered
              ? `Covered — with ${money(bridge.surplus)} to spare. This is exactly why the pots are kept apart.`
              : `Short by ${money(bridge.shortfall)} — the pension can’t help until ${PENSION_ACCESS_AGE}, so this is the gap to close first.`}
          </Closer>

          <HowWeWorkedThisOut className="mt-6">
            <Working
              formula="Bridge = investments must fund the target each year from an early stop until pension access age."
              numbers={`${yrs(bridge.bridgeYears)} of ${money(target)} needs ${money(bridge.requiredPot)}; you’d have ${money(bridge.potAtStop)}.`}
            />
          </HowWeWorkedThisOut>
        </Card>
      ) : null}

      <Closer className="px-1 text-muted-foreground">
        The value was never the big number. It’s the permission.
      </Closer>
    </AppScreen>
  )
}
