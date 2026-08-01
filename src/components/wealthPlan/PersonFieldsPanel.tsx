/**
 * Inline editable fields for one person — "You" or anyone added alongside
 * them. Same field set either way, since the page collects the exact same
 * numbers for everyone: name, age, plan-to age, salary, pension, both ISAs,
 * cash savings, bonus. Rendered directly in the form's right-hand column
 * (not a popup) — see WealthPlanForm's two-column layout.
 *
 * Explicit save, not live — matches every other form on this page. The
 * parent collapses this back to a summary card on save, so the page stays
 * out of the way of the results once a person's numbers are in.
 */
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { TARGET_AGE } from '@/config'
import type { Person } from '@/lib/household'
import { POT_KEYS, POT_LABELS, type PotKey } from '@/lib/wealthPlan'
import { rateToPct } from '@/lib/wealthPlanSearch'
import { Field, Section } from './WealthPlanForm'

type PersonFieldState = {
  name: string
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
}

const EMPTY_FIELDS: PersonFieldState = {
  name: '',
  age: '',
  targetAge: String(TARGET_AGE),
  salary: '',
  pensionPct: '',
  pension: '',
  isaStocks: '',
  isaStocksMonthly: '',
  isaCash: '',
  isaCashMonthly: '',
  cashSavings: '',
  cashSavingsMonthly: '',
  bonus: '',
  bonusTarget: 'isaStocks',
}

function toFieldState(person: Person | undefined): PersonFieldState {
  if (!person) return EMPTY_FIELDS
  const s = (n: number) => (n ? String(n) : '')
  return {
    name: person.name,
    age: String(person.age),
    targetAge: String(person.targetAge),
    salary: s(person.salary),
    pensionPct: person.pensionPct ? String(rateToPct(person.pensionPct)) : '',
    pension: s(person.pension),
    isaStocks: s(person.isaStocks),
    isaStocksMonthly: s(person.isaStocksMonthly),
    isaCash: s(person.isaCash),
    isaCashMonthly: s(person.isaCashMonthly),
    cashSavings: s(person.cashSavings),
    cashSavingsMonthly: s(person.cashSavingsMonthly),
    bonus: s(person.bonus),
    bonusTarget: person.bonusTarget,
  }
}

function toFields(f: PersonFieldState, fallbackName: string): Omit<Person, 'id'> {
  const n = (x: string) => {
    const v = Number(x)
    return x.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : 0
  }
  return {
    name: f.name.trim() || fallbackName,
    age: n(f.age),
    targetAge: n(f.targetAge) || TARGET_AGE,
    salary: n(f.salary),
    pensionPct: n(f.pensionPct) / 100,
    pension: n(f.pension),
    isaStocks: n(f.isaStocks),
    isaCash: n(f.isaCash),
    cashSavings: n(f.cashSavings),
    isaStocksMonthly: n(f.isaStocksMonthly),
    isaCashMonthly: n(f.isaCashMonthly),
    cashSavingsMonthly: n(f.cashSavingsMonthly),
    bonus: n(f.bonus),
    bonusTarget: f.bonusTarget,
  }
}

export function PersonFieldsPanel({
  person,
  fallbackName,
  saveLabel,
  canRemove,
  removeLabel,
  onSave,
  onRemove,
  onCancel,
}: {
  /** undefined = adding a brand new person */
  person: Person | undefined
  /** the Name field's placeholder, and the stored name if it's left blank */
  fallbackName: string
  saveLabel: string
  canRemove: boolean
  removeLabel: string
  onSave: (fields: Omit<Person, 'id'>) => void
  onRemove: () => void
  onCancel: () => void
}) {
  const [f, setF] = useState<PersonFieldState>(() => toFieldState(person))
  const set = (k: keyof Omit<PersonFieldState, 'bonusTarget'>) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }))
  const age = Number(f.age)
  const canSave = Number.isFinite(age) && age > 0 && age < 120

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        onSave(toFields(f, fallbackName))
      }}
      className="@container rounded-2xl border border-border/60 p-5 sm:p-6"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
          <Field label="Name" value={f.name} onChange={set('name')} placeholder={fallbackName} />
          <Field
            label="Age"
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
            hint="used only for their pension contribution"
            prefix="£"
            value={f.salary}
            onChange={set('salary')}
            placeholder="55,000"
          />
        </div>

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
          <div className="flex h-full flex-col">
            <span className="text-[12.5px] font-medium leading-snug text-foreground">
              Add it to
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {POT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setF((p) => ({ ...p, bonusTarget: key }))}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors',
                    f.bonusTarget === key
                      ? 'bg-foreground text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {POT_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-full bg-foreground px-6 py-3.5 text-center text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Cancel
        </button>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {removeLabel}
          </button>
        ) : null}
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground">
        Nothing is saved or sent. Your numbers stay in the page.
      </p>
    </form>
  )
}
