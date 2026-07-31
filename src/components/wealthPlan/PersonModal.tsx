/**
 * Add or edit one additional household member — opened from the form's
 * "Add a person" tile or a person card's Edit link. Same field set as the
 * main form above (person 1, "You"), plus a name, because that's the one
 * thing this page collects per-person rather than once: everyone gets their
 * own age, plan-to age, salary, pension, ISA split and bonus, held and
 * forecast separately before being combined in the results.
 *
 * Explicit save, not live — mirrors ContributionModal's shell (same pattern
 * as components/results/HookModal.tsx), not the authenticated app's Modal or
 * its own PersonCard: this page never imports from components/app.
 */
import { useState } from 'react'
import { X } from 'lucide-react'
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

function toFields(f: PersonFieldState): Omit<Person, 'id'> {
  const n = (x: string) => {
    const v = Number(x)
    return x.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : 0
  }
  return {
    name: f.name.trim() || 'Person',
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

export function PersonModal({
  person,
  onSave,
  onRemove,
  onClose,
}: {
  /** undefined means "adding a new person" */
  person: Person | undefined
  onSave: (fields: Omit<Person, 'id'>) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [f, setF] = useState<PersonFieldState>(() => toFieldState(person))
  const set = (k: keyof Omit<PersonFieldState, 'bonusTarget'>) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }))
  const age = Number(f.age)
  const canSave = f.name.trim() !== '' && Number.isFinite(age) && age > 0 && age < 120

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-soft sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="person-modal-title" className="text-[17px] font-semibold tracking-tight">
            {person ? `Edit ${person.name}` : 'Add a person'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          Same numbers as your own plan above — held and forecast separately, then
          combined in the results.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSave) return
            onSave(toFields(f))
            onClose()
          }}
          className="mt-5 space-y-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" value={f.name} onChange={set('name')} placeholder="Charlotte" />
            <Field
              label="Age"
              value={f.age}
              onChange={set('age')}
              placeholder="32"
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

          <div>
            <button
              type="submit"
              disabled={!canSave}
              className="w-full rounded-full bg-foreground px-6 py-3.5 text-center text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
            >
              {person ? 'Save changes' : 'Add to plan'}
            </button>
            {person ? (
              <button
                type="button"
                onClick={() => {
                  onRemove()
                  onClose()
                }}
                className="mt-3 w-full text-center text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Remove {person.name} from this plan
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
