/**
 * Add/edit an account — structure only (spec extension, restructure brief):
 * who it belongs to, provider, type, and balance. Contribution amounts are
 * no longer set here — that's the Forecast Plan table's job, the one place
 * the contribution schedule is edited, so this form and the Plan table are
 * never two competing places to set the same figure. Balance is entered
 * when ADDING, or on EDIT for an account that was created without one (the
 * "I skipped it" recovery path) — once a balance exists, further updates
 * belong to the Growth tab's update flow, never a direct silent edit here.
 * Ring-fenced/goal-earmarked only show once the chosen type resolves to cash.
 */
import { useState } from 'react'
import { personToOwner, type AccountOwner } from '@/lib/accountOwner'
import { AppField } from './AppField'
import { AppSelect } from './AppSelect'
import { AppCheckbox } from './AppCheckbox'

export type AccountFormPerson = {
  id: string
  name: string
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
  openingBalance: string
}

export type AccountFormPayload = {
  personId: string | null
  owner: AccountOwner
  provider: string
  accountType: string
  isRingFenced: boolean
  isGoalEarmarked: boolean
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
  people: AccountFormPerson[]
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
    openingBalance: initial?.openingBalance ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof AccountFormValues>(k: K) => (v: AccountFormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }))

  const potCategory = accountTypeToPotCategory(values.accountType)
  const isCash = potCategory === 'cash'
  // balance is entered on add, or on edit for an account that's never had one recorded
  const showBalanceField = isNew || currentBalance === null

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
        the account type, not set directly. Set what goes in monthly on the Forecast tab's Plan
        table, not here.
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
