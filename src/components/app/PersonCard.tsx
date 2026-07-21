/**
 * A person's setup card — display mode shows name/age/salary/bonus/employer
 * pension %, edit mode is the same card with inline fields. A `null` person
 * means "new" — starts in edit mode with blank fields.
 */
import { useState } from 'react'
import { money, percent } from '@/lib/format'
import { AppField } from './AppField'

export type PersonFormValues = {
  name: string
  age: string
  retirementAge: string
  salary: string
  salaryGrowthPct: string
  bonus: string
  employerPensionUserPct: string
  employerPensionMatchPct: string
  employerPensionAdditionalPct: string
}

export type PersonData = {
  id: string
  name: string
  age: number
  retirementAge: number
  salary: number | null
  salaryGrowthPct: number | null
  bonus: number | null
  employerPensionUserPct: number | null
  employerPensionMatchPct: number | null
  employerPensionAdditionalPct: number | null
}

const EMPTY: PersonFormValues = {
  name: '',
  age: '',
  retirementAge: '60',
  salary: '',
  salaryGrowthPct: '',
  bonus: '',
  employerPensionUserPct: '',
  employerPensionMatchPct: '',
  employerPensionAdditionalPct: '',
}

function toFormValues(p: PersonData): PersonFormValues {
  const s = (n: number | null) => (n === null ? '' : String(n))
  const pct = (n: number | null) => (n === null ? '' : String(Math.round(n * 1000) / 10))
  return {
    name: p.name,
    age: String(p.age),
    retirementAge: String(p.retirementAge),
    salary: s(p.salary),
    salaryGrowthPct: pct(p.salaryGrowthPct),
    bonus: s(p.bonus),
    employerPensionUserPct: pct(p.employerPensionUserPct),
    employerPensionMatchPct: pct(p.employerPensionMatchPct),
    employerPensionAdditionalPct: pct(p.employerPensionAdditionalPct),
  }
}

export function personFormToPayload(f: PersonFormValues) {
  const n = (x: string) => {
    const v = Number(x)
    return x.trim() !== '' && Number.isFinite(v) ? v : null
  }
  const pctToFraction = (x: string) => {
    const v = n(x)
    return v === null ? null : v / 100
  }
  return {
    name: f.name.trim(),
    age: n(f.age) ?? 0,
    retirementAge: n(f.retirementAge) ?? 60,
    salary: n(f.salary),
    salaryGrowthPct: pctToFraction(f.salaryGrowthPct),
    bonus: n(f.bonus),
    employerPensionUserPct: pctToFraction(f.employerPensionUserPct),
    employerPensionMatchPct: pctToFraction(f.employerPensionMatchPct),
    employerPensionAdditionalPct: pctToFraction(f.employerPensionAdditionalPct),
  }
}

export function PersonCard({
  person,
  latestSalaryChange,
  onSave,
  onCancelNew,
  onUpdateSalary,
}: {
  person: PersonData | null
  /** the most recent actual salary logged for this person, if any — see UpdateSalaryModal */
  latestSalaryChange?: { effectiveYear: number; salary: number } | null
  onSave: (payload: ReturnType<typeof personFormToPayload>) => Promise<void>
  onCancelNew?: () => void
  onUpdateSalary?: () => void
}) {
  const [editing, setEditing] = useState(person === null)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<PersonFormValues>(person ? toFormValues(person) : EMPTY)
  const set = (k: keyof PersonFormValues) => (v: string) => setValues((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    setSaving(true)
    try {
      await onSave(personFormToPayload(values))
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing && person) {
    const employerTotal =
      (person.employerPensionMatchPct ?? 0) + (person.employerPensionAdditionalPct ?? 0)
    const displaySalary = latestSalaryChange?.salary ?? person.salary
    return (
      <div className="rounded-3xl bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight">{person.name}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Age {person.age} · Retiring at {person.retirementAge}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[13px] font-medium text-foreground underline underline-offset-2"
          >
            Edit
          </button>
        </div>
        <div className="mt-4 space-y-1.5 text-[13px] text-muted-foreground">
          {displaySalary !== null ? (
            <p className="flex flex-wrap items-center gap-x-2">
              <span>
                Salary {money(displaySalary)}
                {latestSalaryChange ? ` (as of ${latestSalaryChange.effectiveYear})` : ''}
              </span>
              {onUpdateSalary ? (
                <button
                  type="button"
                  onClick={onUpdateSalary}
                  className="text-[12px] font-medium text-foreground underline underline-offset-2"
                >
                  Update
                </button>
              ) : null}
            </p>
          ) : null}
          {person.bonus !== null ? <p>Bonus {money(person.bonus)}</p> : null}
          {employerTotal > 0 ? (
            <p>
              Employer pension {percent(employerTotal)}
              {person.employerPensionUserPct !== null
                ? ` + ${percent(person.employerPensionUserPct)} you`
                : ''}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AppField label="Name" value={values.name} onChange={set('name')} placeholder="Sam" />
        <AppField
          label="Age"
          value={values.age}
          onChange={set('age')}
          placeholder="36"
          inputMode="numeric"
        />
        <AppField
          label="Retirement age"
          hint="what this person's forecast plans towards"
          value={values.retirementAge}
          onChange={set('retirementAge')}
          placeholder="60"
          inputMode="numeric"
        />
        <AppField
          label="Salary"
          prefix="£"
          value={values.salary}
          onChange={set('salary')}
          placeholder="88,000"
          inputMode="decimal"
        />
        <AppField
          label="Assumed salary growth"
          hint="%/yr — actual updates logged separately"
          value={values.salaryGrowthPct}
          onChange={set('salaryGrowthPct')}
          placeholder="2"
          inputMode="decimal"
        />
        <AppField
          label="Bonus"
          prefix="£"
          value={values.bonus}
          onChange={set('bonus')}
          placeholder="12,000"
          inputMode="decimal"
        />
        <AppField
          label="Employer pension"
          hint="match %"
          value={values.employerPensionMatchPct}
          onChange={set('employerPensionMatchPct')}
          placeholder="6"
          inputMode="decimal"
        />
        <AppField
          label="Your pension"
          hint="contribution %"
          value={values.employerPensionUserPct}
          onChange={set('employerPensionUserPct')}
          placeholder="6"
          inputMode="decimal"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving || !values.name.trim() || !values.age.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {person ? (
          <button
            type="button"
            onClick={() => {
              setValues(toFormValues(person))
              setEditing(false)
            }}
            className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        ) : onCancelNew ? (
          <button
            type="button"
            onClick={onCancelNew}
            className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  )
}
