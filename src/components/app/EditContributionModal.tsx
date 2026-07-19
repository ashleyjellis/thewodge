/**
 * Adds a future change to one pot's monthly contribution — either a flat new
 * amount from a given year, or an annual percentage uplift that compounds
 * every year from then on (e.g. "grow my investing by 1% a year"). Feeds the
 * Plan table's live projection; never touches the frozen Forecast baseline.
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { ContributionChangeType } from '@/lib/scheduledPlan'
import { AppField } from './AppField'
import { AppSelect } from './AppSelect'
import { Modal } from './Modal'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

export function EditContributionModal({
  people,
  years,
  defaultOwner,
  defaultPotCategory,
  defaultYear,
  onSave,
  onClose,
}: {
  people: { id: string; name: string }[]
  years: number[]
  defaultOwner: AccountOwner
  defaultPotCategory: PotCategory
  defaultYear: number
  onSave: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    effectiveYear: number
    changeType: ContributionChangeType
    value: number
  }) => Promise<void>
  onClose: () => void
}) {
  const ownerOptions: { value: AccountOwner; label: string }[] = [
    ...(people[0] ? [{ value: 'person_a' as const, label: people[0].name }] : []),
    ...(people[1] ? [{ value: 'person_b' as const, label: people[1].name }] : []),
    { value: 'joint', label: 'Joint' },
  ]

  const [owner, setOwner] = useState<AccountOwner>(defaultOwner)
  const [potCategory, setPotCategory] = useState<PotCategory>(defaultPotCategory)
  const [effectiveYear, setEffectiveYear] = useState(String(defaultYear))
  const [changeType, setChangeType] = useState<ContributionChangeType>('set')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const parsed = Number(value)
    if (!value.trim() || !Number.isFinite(parsed)) return
    setSaving(true)
    try {
      await onSave({
        owner,
        potCategory,
        effectiveYear: Number(effectiveYear),
        changeType,
        value: changeType === 'grow_pct' ? parsed / 100 : parsed,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Change a future contribution" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <AppSelect
          label="Whose"
          value={owner}
          onChange={(v) => setOwner(v as AccountOwner)}
          options={ownerOptions}
        />
        <AppSelect
          label="Pot"
          value={potCategory}
          onChange={(v) => setPotCategory(v as PotCategory)}
          options={Object.entries(POT_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <AppSelect
          label="From year"
          value={effectiveYear}
          onChange={setEffectiveYear}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <AppSelect
          label="How"
          value={changeType}
          onChange={(v) => setChangeType(v as ContributionChangeType)}
          options={[
            { value: 'set', label: 'A new flat amount' },
            { value: 'grow_pct', label: 'Grow every year' },
          ]}
        />
        {changeType === 'set' ? (
          <AppField
            label="New monthly amount"
            prefix="£"
            inputMode="decimal"
            value={value}
            onChange={setValue}
            placeholder="600"
            className="col-span-2"
          />
        ) : (
          <AppField
            label="Annual growth"
            hint="e.g. 1 for 1% more each year"
            inputMode="decimal"
            value={value}
            onChange={setValue}
            placeholder="1"
            className="col-span-2"
          />
        )}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {changeType === 'set'
          ? `From ${effectiveYear}, this pot's monthly contribution becomes the amount above, until you change it again.`
          : `From ${effectiveYear}, this pot's monthly contribution grows by that percentage every year, until you change it again.`}
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled={saving || !value.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
