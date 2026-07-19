/**
 * Adds a one-off amount in or out of a pot at a specific year — a house
 * deposit, a bonus, a big purchase — layered onto the Plan table's live
 * projection alongside contribution changes.
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import { AppField } from './AppField'
import { AppSelect } from './AppSelect'
import { FilterPill } from './FilterPill'
import { Modal } from './Modal'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

export function AddPlannedEventModal({
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
    year: number
    name: string
    amount: number
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
  const [year, setYear] = useState(String(defaultYear))
  const [name, setName] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const parsed = Number(amount)
    if (!name.trim() || !amount.trim() || !Number.isFinite(parsed) || parsed <= 0) return
    setSaving(true)
    try {
      await onSave({
        owner,
        potCategory,
        year: Number(year),
        name: name.trim(),
        amount: direction === 'in' ? parsed : -parsed,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add a planned event" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <AppField
          label="Event name"
          value={name}
          onChange={setName}
          placeholder="House deposit"
          className="col-span-2"
        />
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
        <AppSelect label="Year" value={year} onChange={setYear} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
        <AppField label="Amount" prefix="£" inputMode="decimal" value={amount} onChange={setAmount} placeholder="10,000" />
      </div>
      <div className="mt-3 flex gap-1">
        <FilterPill active={direction === 'in'} onClick={() => setDirection('in')}>
          Money in
        </FilterPill>
        <FilterPill active={direction === 'out'} onClick={() => setDirection('out')}>
          Money out
        </FilterPill>
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled={saving || !name.trim() || !amount.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Add event'}
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
