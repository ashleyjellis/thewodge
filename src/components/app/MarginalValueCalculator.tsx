/**
 * "Value of an extra £10" — the second of the two v1 nudges (spec: nudge
 * feed). Explicitly isolated from the Today-if sandbox: this touches no
 * contribution_changes, no schedule, no household mutation of any kind —
 * just forecast.ts's future-value maths (via marginalValue.ts) applied to
 * a number the visitor types in, projected to the plan's own crossover
 * year by default or a target age they choose instead.
 */
import { useState } from 'react'
import { calculateMarginalValue, type MarginalValueMode } from '@/lib/marginalValue'
import { monthsToTarget } from '@/lib/forecast'
import { money } from '@/lib/format'
import { AppField } from './AppField'
import { FilterPill } from './FilterPill'

export function MarginalValueCalculator({
  currentAge,
  crossoverYear,
  currentCalendarYear,
  annualRate,
}: {
  currentAge: number
  crossoverYear: number | null
  currentCalendarYear: number
  annualRate: number
}) {
  const [amountInput, setAmountInput] = useState('10')
  const [mode, setMode] = useState<MarginalValueMode>('monthly')
  const [horizon, setHorizon] = useState<'crossover' | 'age'>(crossoverYear !== null ? 'crossover' : 'age')
  const [targetAgeInput, setTargetAgeInput] = useState(String(currentAge + 10))

  const months =
    horizon === 'crossover' && crossoverYear !== null
      ? Math.max(0, (crossoverYear - currentCalendarYear) * 12)
      : monthsToTarget(currentAge, Number(targetAgeInput))

  const amount = Number(amountInput)
  const result =
    amountInput.trim() !== '' && Number.isFinite(amount) && amount > 0
      ? calculateMarginalValue({ amount, mode, annualRate, months })
      : null

  const horizonLabel =
    horizon === 'crossover' && crossoverYear !== null
      ? `to ${crossoverYear}, your plan's crossover year`
      : `to age ${targetAgeInput || currentAge}`

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <p className="text-[15px] font-semibold tracking-tight">Value of a bit extra</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        A quick "what's this actually worth" — separate from the sandbox, nothing here touches
        your plan.
      </p>

      <div className="mt-4 flex gap-1">
        <FilterPill active={mode === 'monthly'} onClick={() => setMode('monthly')}>
          Every month
        </FilterPill>
        <FilterPill active={mode === 'lump'} onClick={() => setMode('lump')}>
          One-off
        </FilterPill>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <AppField
          label={mode === 'monthly' ? 'Extra amount, monthly' : 'Extra amount, one-off'}
          prefix="£"
          inputMode="decimal"
          value={amountInput}
          onChange={setAmountInput}
          placeholder="10"
          className="w-32"
        />
        {crossoverYear !== null ? (
          <div className="flex gap-1">
            <FilterPill active={horizon === 'crossover'} onClick={() => setHorizon('crossover')}>
              To crossover
            </FilterPill>
            <FilterPill active={horizon === 'age'} onClick={() => setHorizon('age')}>
              To an age
            </FilterPill>
          </div>
        ) : null}
        {horizon === 'age' || crossoverYear === null ? (
          <AppField
            label="Target age"
            inputMode="numeric"
            value={targetAgeInput}
            onChange={setTargetAgeInput}
            placeholder="55"
            className="w-28"
          />
        ) : null}
      </div>

      {result ? (
        <div className="mt-5 rounded-2xl bg-accent/30 p-5">
          <p className="text-[13px] text-muted-foreground">
            {mode === 'monthly' ? `£${amountInput}/mo` : `A one-off £${amountInput}`}, {horizonLabel}
          </p>
          <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            {money(result.futureValue)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            You'd put in {money(result.totalContributed)} · growth adds {money(result.growth)}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-muted-foreground">Enter an amount above to see its value.</p>
      )}
    </div>
  )
}
