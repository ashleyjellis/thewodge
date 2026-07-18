/**
 * The calculator — age, pension, stocks/shares, cash, and a monthly contribution.
 * Stateless: on submit it hands the values up so the caller can write them to the
 * URL. Low friction — clean number fields, all optional-but-encouraged.
 *
 * `variant="full"` adds two further optional fields (monthly pension contribution,
 * annual income) — used only on the /results "adjust your numbers" form, never on
 * the landing hero, so the first thing anyone sees stays a fast, three-to-four-
 * field instrument.
 */
import { useState } from 'react'
import type { CalculatorSearch } from '@/lib/search'
import { cn } from '@/lib/cn'

type FieldState = {
  age: string
  pension: string
  stocks: string
  cash: string
  monthly: string
  pensionMonthly: string
  income: string
}

function toFieldState(v: CalculatorSearch): FieldState {
  const s = (n: number | undefined) => (n === undefined ? '' : String(n))
  return {
    age: s(v.age),
    pension: s(v.pension),
    stocks: s(v.stocks),
    cash: s(v.cash),
    monthly: s(v.monthly),
    pensionMonthly: s(v.pensionMonthly),
    income: s(v.income),
  }
}

function toSearch(f: FieldState): CalculatorSearch {
  const n = (x: string) => {
    const v = Number(x)
    return x.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : undefined
  }
  return {
    age: n(f.age),
    pension: n(f.pension),
    stocks: n(f.stocks),
    cash: n(f.cash),
    monthly: n(f.monthly),
    pensionMonthly: n(f.pensionMonthly),
    income: n(f.income),
  }
}

export function Calculator({
  initial,
  onSubmit,
  submitLabel = 'See your trajectory',
  variant = 'compact',
  className,
}: {
  initial: CalculatorSearch
  onSubmit: (values: CalculatorSearch) => void
  submitLabel?: string
  /** 'full' adds pension contribution + income — results page only */
  variant?: 'compact' | 'full'
  className?: string
}) {
  const [f, setF] = useState<FieldState>(() => toFieldState(initial))
  const set = (k: keyof FieldState) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const full = variant === 'full'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(toSearch(f))
      }}
      className={cn('rounded-3xl bg-card p-6 shadow-soft sm:p-8', className)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Your age"
          value={f.age}
          onChange={set('age')}
          placeholder="38"
          inputMode="numeric"
        />
        {full ? (
          <Field
            label="Your annual income"
            hint="used to estimate a pension contribution if you leave that blank"
            prefix="£"
            value={f.income}
            onChange={set('income')}
            placeholder="65,000"
          />
        ) : (
          <Field
            label="Monthly contribution"
            hint="to your investments"
            prefix="£"
            value={f.monthly}
            onChange={set('monthly')}
            placeholder="300"
          />
        )}
        <Field
          label="Pension value"
          prefix="£"
          value={f.pension}
          onChange={set('pension')}
          placeholder="120,000"
        />
        {full ? (
          <Field
            id="pension-contribution-field"
            label="Monthly pension contribution"
            hint="optional — makes your pension forecast accurate rather than assumed"
            prefix="£"
            value={f.pensionMonthly}
            onChange={set('pensionMonthly')}
            placeholder="500"
          />
        ) : (
          <Field
            label="Stocks & shares"
            hint="ISA / investments"
            prefix="£"
            value={f.stocks}
            onChange={set('stocks')}
            placeholder="60,000"
          />
        )}
        {full ? (
          <>
            <Field
              label="Stocks & shares"
              hint="ISA / investments"
              prefix="£"
              value={f.stocks}
              onChange={set('stocks')}
              placeholder="60,000"
            />
            <Field
              label="Monthly contribution"
              hint="to your investments"
              prefix="£"
              value={f.monthly}
              onChange={set('monthly')}
              placeholder="300"
            />
          </>
        ) : null}
        <Field
          label="Cash savings"
          prefix="£"
          value={f.cash}
          onChange={set('cash')}
          placeholder="20,000"
          className="sm:col-span-2"
        />
      </div>

      <button
        type="submit"
        className="mt-6 w-full rounded-full bg-foreground px-6 py-4 text-center text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
      >
        {submitLabel}
      </button>
      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Nothing is saved or sent. Your numbers stay in the page.
      </p>
    </form>
  )
}

function Field({
  label,
  hint,
  prefix,
  value,
  onChange,
  placeholder,
  inputMode = 'decimal',
  className,
  id,
}: {
  label: string
  hint?: string
  prefix?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  className?: string
  id?: string
}) {
  // strip commas so "120,000" pastes cleanly
  const handle = (raw: string) => onChange(raw.replace(/,/g, ''))
  return (
    // full height + input pushed to the bottom, so wrapped labels never shift the
    // box out of line with its neighbour in the same row
    <label id={id} className={cn('flex h-full scroll-mt-24 flex-col', className)}>
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
      </span>
    </label>
  )
}
