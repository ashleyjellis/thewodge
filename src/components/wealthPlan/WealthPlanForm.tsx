/**
 * The wealth planning tool's data-capture form — salary and age, pension as a
 * percentage of salary, ISA cash and ISA stocks & shares as separate monthly
 * contributions, cash savings, an expected annual bonus, and a starting balance for
 * every pot. Same visual language as the free calculator's own form (bg-muted
 * rounded-2xl fields) — grouped into sections because this one asks for a lot more.
 *
 * Stateless: on submit it hands values up so the caller writes them to the URL,
 * same as the free calculator. Explicit submit, not live-as-you-type — matches how
 * the rest of the site's calculators work.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { POT_KEYS, POT_LABELS, type PotKey } from '@/lib/wealthPlan'
import { rateToPct, type WealthPlanSearch } from '@/lib/wealthPlanSearch'
import { CASH_RATE, INVESTED_RATE, TARGET_AGE } from '@/config'
import { cn } from '@/lib/cn'

const DEFAULT_INVESTED_PCT = rateToPct(INVESTED_RATE)
const DEFAULT_CASH_PCT = rateToPct(CASH_RATE)

type FieldState = {
  age: string
  targetAge: string
  salary: string
  pensionPct: string
  pension: string
  isaStocks: string
  isaStocksMonthly: string
  isaCash: string
  isaCashMonthly: string
  cashSavings: string
  cashSavingsMonthly: string
  bonus: string
  bonusTarget: PotKey
  investedRatePct: string
  cashRatePct: string
}

function toFieldState(v: WealthPlanSearch): FieldState {
  const s = (n: number | undefined) => (n === undefined ? '' : String(n))
  return {
    age: s(v.age),
    targetAge: s(v.targetAge ?? TARGET_AGE),
    salary: s(v.salary),
    pensionPct: s(v.pensionPct),
    pension: s(v.pension),
    isaStocks: s(v.isaStocks),
    isaStocksMonthly: s(v.isaStocksMonthly),
    isaCash: s(v.isaCash),
    isaCashMonthly: s(v.isaCashMonthly),
    cashSavings: s(v.cashSavings),
    cashSavingsMonthly: s(v.cashSavingsMonthly),
    bonus: s(v.bonus),
    bonusTarget: v.bonusTarget ?? 'isaStocks',
    investedRatePct: s(v.investedRatePct ?? DEFAULT_INVESTED_PCT),
    cashRatePct: s(v.cashRatePct ?? DEFAULT_CASH_PCT),
  }
}

function toSearchValues(f: FieldState): WealthPlanSearch {
  const n = (x: string) => {
    const v = Number(x)
    return x.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : undefined
  }
  return {
    age: n(f.age),
    targetAge: n(f.targetAge),
    salary: n(f.salary),
    pensionPct: n(f.pensionPct),
    pension: n(f.pension),
    isaStocks: n(f.isaStocks),
    isaStocksMonthly: n(f.isaStocksMonthly),
    isaCash: n(f.isaCash),
    isaCashMonthly: n(f.isaCashMonthly),
    cashSavings: n(f.cashSavings),
    cashSavingsMonthly: n(f.cashSavingsMonthly),
    bonus: n(f.bonus),
    bonusTarget: f.bonusTarget,
    investedRatePct: n(f.investedRatePct),
    cashRatePct: n(f.cashRatePct),
  }
}

export function WealthPlanForm({
  initial,
  onSubmit,
  submitLabel = 'See your plan',
  className,
}: {
  initial: WealthPlanSearch
  onSubmit: (values: WealthPlanSearch) => void
  submitLabel?: string
  className?: string
}) {
  const [f, setF] = useState<FieldState>(() => toFieldState(initial))
  const set = (k: keyof Omit<FieldState, 'bonusTarget'>) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(toSearchValues(f))
      }}
      className={cn('rounded-3xl bg-card p-6 shadow-soft sm:p-8', className)}
    >
      <div className="space-y-7">
        <Section title="About you" cols={3}>
          <Field
            label="Your age"
            value={f.age}
            onChange={set('age')}
            placeholder="34"
            inputMode="numeric"
          />
          <Field
            label="Plan to age"
            hint="when you're forecasting to"
            value={f.targetAge}
            onChange={set('targetAge')}
            placeholder={String(TARGET_AGE)}
            inputMode="numeric"
          />
          <Field
            label="Annual salary"
            hint="used only to work out your pension contribution"
            prefix="£"
            value={f.salary}
            onChange={set('salary')}
            placeholder="55,000"
            className="sm:col-span-2 lg:col-span-1"
          />
        </Section>

        <Section title="Pension">
          <Field
            label="Current pension value"
            prefix="£"
            value={f.pension}
            onChange={set('pension')}
            placeholder="60,000"
          />
          <Field
            label="Contribution"
            hint="% of salary, monthly"
            suffix="%"
            value={f.pensionPct}
            onChange={set('pensionPct')}
            placeholder="5"
          />
        </Section>

        <Section title="ISA — stocks & shares">
          <Field
            label="Current value"
            prefix="£"
            value={f.isaStocks}
            onChange={set('isaStocks')}
            placeholder="15,000"
          />
          <Field
            label="Monthly contribution"
            prefix="£"
            value={f.isaStocksMonthly}
            onChange={set('isaStocksMonthly')}
            placeholder="250"
          />
        </Section>

        <Section title="ISA — cash">
          <Field
            label="Current value"
            prefix="£"
            value={f.isaCash}
            onChange={set('isaCash')}
            placeholder="5,000"
          />
          <Field
            label="Monthly contribution"
            prefix="£"
            value={f.isaCashMonthly}
            onChange={set('isaCashMonthly')}
            placeholder="100"
          />
        </Section>

        <Section title="Cash savings" hint="outside an ISA">
          <Field
            label="Current value"
            prefix="£"
            value={f.cashSavings}
            onChange={set('cashSavings')}
            placeholder="8,000"
          />
          <Field
            label="Monthly contribution"
            prefix="£"
            value={f.cashSavingsMonthly}
            onChange={set('cashSavingsMonthly')}
            placeholder="150"
          />
        </Section>

        <Section title="Bonus" hint="optional">
          <Field
            label="Expected annual bonus"
            prefix="£"
            value={f.bonus}
            onChange={set('bonus')}
            placeholder="2,000"
          />
          <BonusTargetPicker
            value={f.bonusTarget}
            onChange={(bonusTarget) => setF((p) => ({ ...p, bonusTarget }))}
          />
        </Section>

        <Section
          title="Assumptions"
          hint={
            <>
              {f.investedRatePct || DEFAULT_INVESTED_PCT}% investments ·{' '}
              {f.cashRatePct || DEFAULT_CASH_PCT}% cash — yours to change
            </>
          }
          collapsible
        >
          <Field
            label="Investment growth rate"
            hint="pension & ISA stocks and shares, per year"
            suffix="%"
            value={f.investedRatePct}
            onChange={set('investedRatePct')}
            placeholder={String(DEFAULT_INVESTED_PCT)}
          />
          <Field
            label="Cash growth rate"
            hint="ISA cash & cash savings, per year"
            suffix="%"
            value={f.cashRatePct}
            onChange={set('cashRatePct')}
            placeholder={String(DEFAULT_CASH_PCT)}
          />
        </Section>
      </div>

      <button
        type="submit"
        className="mt-7 w-full rounded-full bg-foreground px-6 py-4 text-center text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
      >
        {submitLabel}
      </button>
      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Nothing is saved or sent. Your numbers stay in the page.
      </p>
    </form>
  )
}

function Section({
  title,
  hint,
  cols = 2,
  collapsible = false,
  children,
}: {
  title: string
  hint?: ReactNode
  cols?: 2 | 3
  /** renders as a closed-by-default <details> — for optional, advanced fields */
  collapsible?: boolean
  children: ReactNode
}) {
  const heading = (
    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {title}
      {hint ? (
        <span className="ml-1.5 normal-case font-normal text-muted-foreground/70">
          {hint}
        </span>
      ) : null}
    </p>
  )
  const grid = (
    <div
      className={cn(
        'mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2',
        cols === 3 && 'lg:grid-cols-3',
      )}
    >
      {children}
    </div>
  )

  if (collapsible) {
    return (
      <details className="border-t border-border/60 pt-7">
        <summary className="flex items-center justify-between gap-3">
          {heading}
          <ChevronDown
            size={16}
            strokeWidth={2.25}
            className="drawer-chevron shrink-0 text-muted-foreground"
          />
        </summary>
        {grid}
      </details>
    )
  }

  return (
    <div className="border-t border-border/60 pt-7 first:border-t-0 first:pt-0">
      {heading}
      {grid}
    </div>
  )
}

function BonusTargetPicker({
  value,
  onChange,
}: {
  value: PotKey
  onChange: (v: PotKey) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <span className="text-[13px] font-medium leading-snug text-foreground">
        Add the bonus to
      </span>
      <div className="mt-3 flex flex-wrap gap-2">
        {POT_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors',
              value === key
                ? 'bg-foreground text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {POT_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
  inputMode = 'decimal',
  className,
}: {
  label: string
  hint?: string
  prefix?: string
  suffix?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  className?: string
}) {
  // strip commas so "120,000" pastes cleanly
  const handle = (raw: string) => onChange(raw.replace(/,/g, ''))
  return (
    <label className={cn('flex h-full flex-col', className)}>
      <span className="text-[13px] font-medium leading-snug text-foreground">
        {label}
        {hint ? (
          <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="mt-3 flex items-center gap-1 rounded-2xl bg-muted px-4 py-3 ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-foreground/25">
        {prefix ? (
          <span className="text-[18px] font-semibold text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => handle(e.target.value)}
          className="w-full bg-transparent text-[18px] font-semibold tabular-nums tracking-tight text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
        />
        {suffix ? (
          <span className="text-[18px] font-semibold text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  )
}
