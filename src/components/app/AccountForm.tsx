/**
 * Add/edit an account. Balance is entered when ADDING, or on EDIT for an account
 * that was created without one (the "I skipped it" recovery path) — once a
 * balance exists, further updates belong to the Growth tab's update flow (a
 * later phase), never a direct silent edit here.
 * Ring-fenced/goal-earmarked only show once the chosen type resolves to cash.
 */
import { useState } from 'react'
import { personToOwner, type AccountOwner } from '@/lib/accountOwner'
import { money } from '@/lib/format'
import { AppField } from './AppField'
import { AppSelect } from './AppSelect'
import { AppCheckbox } from './AppCheckbox'

export type ContributionEstimatePerson = {
  id: string
  name: string
  salary: number | null
  employerPensionUserPct: number | null
  employerPensionMatchPct: number | null
  employerPensionAdditionalPct: number | null
}

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'cash_isa', label: 'Cash ISA' },
  { value: 'stocks_isa', label: 'Stocks & shares ISA' },
  { value: 'pension', label: 'Pension' },
  { value: 'lisa', label: 'LISA' },
  { value: 'savings_account', label: 'Savings account' },
  { value: 'other', label: 'Other' },
]

function accountTypeToPotCategory(t: string): 'pension' | 'investments' | 'cash' {
  if (t === 'pension') return 'pension'
  if (t === 'cash_isa' || t === 'savings_account') return 'cash'
  return 'investments'
}

export type AccountFormValues = {
  personId: string | null // null = joint
  provider: string
  accountType: string
  isRingFenced: boolean
  isGoalEarmarked: boolean
  monthlyContribution: string
  openingBalance: string
}

export type AccountFormPayload = {
  personId: string | null
  owner: AccountOwner
  provider: string
  accountType: string
  isRingFenced: boolean
  isGoalEarmarked: boolean
  monthlyContribution: number
  openingBalance?: number
}

export function AccountForm({
  people,
  initial,
  isNew,
  currentBalance = null,
  onSubmit,
  onCancel,
}: {
  people: ContributionEstimatePerson[]
  initial?: Partial<AccountFormValues>
  isNew: boolean
  /** the account's real recorded balance — only meaningful on edit (isNew=false) */
  currentBalance?: number | null
  onSubmit: (payload: AccountFormPayload) => Promise<void>
  onCancel: () => void
}) {
  const [values, setValues] = useState<AccountFormValues>({
    personId: initial?.personId ?? (people[0]?.id ?? null),
    provider: initial?.provider ?? '',
    accountType: initial?.accountType ?? 'stocks_isa',
    isRingFenced: initial?.isRingFenced ?? false,
    isGoalEarmarked: initial?.isGoalEarmarked ?? false,
    monthlyContribution: initial?.monthlyContribution ?? '',
    openingBalance: initial?.openingBalance ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof AccountFormValues>(k: K) => (v: AccountFormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }))

  const potCategory = accountTypeToPotCategory(values.accountType)
  const isCash = potCategory === 'cash'
  // balance is entered on add, or on edit for an account that's never had one recorded
  const showBalanceField = isNew || currentBalance === null

  const selectedPerson = values.personId ? people.find((p) => p.id === values.personId) : null
  const pensionPct = selectedPerson
    ? (selectedPerson.employerPensionUserPct ?? 0) +
      (selectedPerson.employerPensionMatchPct ?? 0) +
      (selectedPerson.employerPensionAdditionalPct ?? 0)
    : 0
  const estimatedMonthly =
    values.accountType === 'pension' && selectedPerson?.salary && pensionPct > 0
      ? Math.round((selectedPerson.salary * pensionPct) / 12)
      : null

  const submit = async () => {
    setSaving(true)
    try {
      const n = (x: string) => {
        const v = Number(x)
        return x.trim() !== '' && Number.isFinite(v) ? v : undefined
      }
      await onSubmit({
        personId: values.personId,
        owner: personToOwner(people, values.personId),
        provider: values.provider.trim(),
        accountType: values.accountType,
        isRingFenced: isCash ? values.isRingFenced : false,
        isGoalEarmarked: isCash ? values.isGoalEarmarked : false,
        monthlyContribution: n(values.monthlyContribution) ?? 0,
        openingBalance: showBalanceField ? n(values.openingBalance) : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const ownerOptions = [
    ...people.map((p) => ({ value: p.id, label: p.name })),
    { value: '__joint__', label: 'Joint' },
  ]

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AppSelect
          label="Belongs to"
          value={values.personId ?? '__joint__'}
          onChange={(v) => set('personId')(v === '__joint__' ? null : v)}
          options={ownerOptions}
        />
        <AppSelect
          label="Account type"
          value={values.accountType}
          onChange={set('accountType')}
          options={ACCOUNT_TYPE_OPTIONS}
        />
        <AppField
          label="Provider"
          value={values.provider}
          onChange={set('provider')}
          placeholder="Hargreaves Lansdown"
          className="col-span-2"
        />
        <div className="flex flex-col gap-1.5">
          <AppField
            label="Monthly contribution"
            prefix="£"
            inputMode="decimal"
            value={values.monthlyContribution}
            onChange={set('monthlyContribution')}
            placeholder="300"
          />
          {estimatedMonthly !== null ? (
            <button
              type="button"
              onClick={() => set('monthlyContribution')(String(estimatedMonthly))}
              className="text-left text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Estimate from {selectedPerson!.name}'s salary & pension %: {money(estimatedMonthly)}
              /mo — use this
            </button>
          ) : null}
        </div>
        {showBalanceField ? (
          <AppField
            label="Current balance"
            prefix="£"
            inputMode="decimal"
            value={values.openingBalance}
            onChange={set('openingBalance')}
            placeholder="60,000"
          />
        ) : null}
        {isCash ? (
          <>
            <AppCheckbox
              label="Ring-fenced"
              hint="emergency fund — still counted and still grows, just labelled separately"
              checked={values.isRingFenced}
              onChange={set('isRingFenced')}
            />
            <AppCheckbox
              label="Goal-earmarked"
              hint="e.g. a house deposit"
              checked={values.isGoalEarmarked}
              onChange={set('isGoalEarmarked')}
            />
          </>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-muted-foreground">
        Pot: <span className="font-medium text-foreground">{potCategory}</span> — derived from
        the account type, not set directly.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving || !values.provider.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : isNew ? 'Add account' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
