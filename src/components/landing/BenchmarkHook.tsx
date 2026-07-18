/**
 * Landing hook v1 — "Where do you stand?" (spec §1). Two inputs (age + total
 * invested), an instant benchmark + free-money read-out, one CTA into signup.
 * Self-contained and swappable: a second hook can implement the same onContinue
 * contract and be A/B tested in its place.
 */
import { useState } from 'react'
import { benchmarkMultiple, BENCHMARK_SOURCE } from '@/lib/benchmarks'
import { futureValueOfAmount } from '@/lib/calc/lifetimeValue'
import { DEFAULT_ASSUMPTIONS } from '@/lib/calc/types'
import { money, multiple, percent } from '@/lib/format'
import { Card, Eyebrow, HeroFigure, Muted } from '@/components/brand'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { primaryButtonClass } from '@/components/PrimaryButton'
import { cn } from '@/lib/cn'

const HORIZON = 10
const r = DEFAULT_ASSUMPTIONS.realReturn

export function BenchmarkHook({
  onContinue,
}: {
  onContinue: (result: { age: number; invested: number }) => void
}) {
  const [age, setAge] = useState(36)
  const [invested, setInvested] = useState(221_000)

  const bench = benchmarkMultiple(invested, age)
  const marketAdds = futureValueOfAmount(invested, r, HORIZON) - invested

  return (
    <>
      <Card>
        <Eyebrow>where do you stand</Eyebrow>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field
            label="Your age"
            value={age}
            min={16}
            max={80}
            onChange={setAge}
          />
          <Field
            label="Total invested"
            value={invested}
            min={0}
            step={1000}
            prefix="£"
            onChange={setInvested}
          />
        </div>
        <Muted className="mt-2 text-[12px]">
          Pension and investments combined — today’s money.
        </Muted>

        <div className="mt-7">
          <HeroFigure>{multiple(bench.multiple)}</HeroFigure>
          <Muted className="mt-2">
            the median pension for your age. You’re {age}, holding{' '}
            {money(invested)}.
          </Muted>
        </div>

        <div className="mt-6 rounded-2xl bg-accent/40 p-5">
          <p className="text-[14px] leading-relaxed text-foreground">
            At {percent(r)} a year, the market alone would add{' '}
            <span className="font-semibold tabular-nums">
              {money(marketAdds)}
            </span>{' '}
            over the next {HORIZON} years — before you add a penny.
          </p>
        </div>

        <HowWeWorkedThisOut className="mt-6">
          <Working
            formula="Multiple = your invested total ÷ the median private pension for your age band."
            numbers={`${money(invested)} ÷ ${money(bench.median)} = ${multiple(bench.multiple)}`}
          />
          <Working
            formula={`Market-alone growth = your total compounded for ${HORIZON} years, minus what you hold now.`}
            numbers={`${money(invested)} × (1 + ${percent(r)})^${HORIZON} − ${money(invested)} = ${money(marketAdds)}`}
          />
          <p>
            Benchmark: {BENCHMARK_SOURCE.name}, as of {BENCHMARK_SOURCE.asOf}.{' '}
            {BENCHMARK_SOURCE.note}
          </p>
        </HowWeWorkedThisOut>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background from-55% to-transparent pb-6 pt-10">
        <div className="mx-auto max-w-[420px] px-5">
          <button
            type="button"
            className={cn(primaryButtonClass)}
            onClick={() => onContinue({ age, invested })}
          >
            See your full wealth picture →
          </button>
        </div>
      </div>
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
}) {
  return (
    <label className="block rounded-2xl bg-muted px-4 py-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 flex items-baseline gap-1">
        {prefix ? (
          <span className="text-[18px] font-semibold text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) onChange(n)
          }}
          className="w-full bg-transparent text-[22px] font-semibold tabular-nums tracking-tight text-foreground outline-none"
        />
      </span>
    </label>
  )
}
