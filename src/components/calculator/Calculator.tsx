/**
 * The calculator — age, pension, stocks/shares, cash, and a monthly contribution.
 * Stateless: on submit it hands the values up so the caller can write them to the
 * URL. Low friction — clean number fields, all optional-but-encouraged.
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
}

function toFieldState(v: CalculatorSearch): FieldState {
  const s = (n: number | undefined) => (n === undefined ? '' : String(n))
  return {
    age: s(v.age),
    pension: s(v.pension),
    stocks: s(v.stocks),
    cash: s(v.cash),
    monthly: s(v.monthly),
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
  }
}

export function Calculator({
  initial,
  onSubmit,
  submitLabel = 'See your trajectory',
  className,
}: {
  initial: CalculatorSearch
  onSubmit: (values: CalculatorSearch) => void
  submitLabel?: string
  className?: string
}) {
  const [f, setF] = useState<FieldState>(() => toFieldState(initial))
  const set = (k: keyof FieldState) => (v: string) => setF((p) => ({ ...p, [k]: v }))

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
        <Field
          label="Monthly contribution"
          hint="to your investments"
          prefix="£"
          value={f.monthly}
          onChange={set('monthly')}
          placeholder="300"
        />
        <Field
          label="Pension value"
          prefix="£"
          value={f.pension}
          onChange={set('pension')}
          placeholder="120,000"
        />
        <Field
          label="Stocks & shares"
          hint="ISA / investments"
          prefix="£"
          value={f.stocks}
          onChange={set('stocks')}
          placeholder="60,000"
        />
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
}: {
  label: string
  hint?: string
  prefix?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  className?: string
}) {
  // strip commas so "120,000" pastes cleanly
  const handle = (raw: string) => onChange(raw.replace(/,/g, ''))
  return (
    <label className={cn('block', className)}>
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      {hint ? (
        <span className="ml-1.5 text-[12px] text-muted-foreground">{hint}</span>
      ) : null}
      <span className="mt-2 flex items-center gap-1 rounded-2xl bg-muted px-4 py-3 ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-foreground/25">
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
