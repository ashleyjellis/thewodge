/**
 * Add/edit an account. Balance is only entered when ADDING — it creates the first
 * append-only snapshot (spec §2); editing a balance afterwards belongs to the
 * Growth tab's update flow (a later phase), never a direct silent edit here.
 * Ring-fenced/goal-earmarked only show once the chosen type resolves to cash.
 */
import { useState } from 'react'
import { personToOwner, type AccountOwner } from '@/lib/accountOwner'
import { AppField } from './AppField'
import { AppSelect } from './AppSelect'
import { AppCheckbox } from './AppCheckbox'

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
  onSubmit,
  onCancel,
}: {
  people: { id: string; name: string }[]
  initial?: Partial<AccountFormValues>
  isNew: boolean
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
        openingBalance: isNew ? n(values.openingBalance) : undefined,
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
        <AppField
          label="Monthly contribution"
          prefix="£"
          value={values.monthlyContribution}
          onChange={set('monthlyContribution')}
          placeholder="300"
        />
        {isNew ? (
          <AppField
            label="Current balance"
            prefix="£"
            value={values.openingBalance}
            onChange={set('openingBalance')}
            placeholder="60,000"
          />
        ) : null}
        {isCash ? (
          <>
            <AppCheckbox
              label="Ring-fenced"
              hint="emergency fund — excluded from investable views"
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
