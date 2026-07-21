/**
 * What one year's Contributions total in the Plan table is actually made
 * of — up to six independent (person, pot) figures, each edited inline
 * rather than through a generic "pick who and what" modal. A percentage
 * growth rule is the one thing still handled by EditContributionModal
 * (opened per row via "Grow %/yr instead"), since a compounding rule needs
 * more explaining than an inline number field comfortably gives.
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { ContributionBreakdownRow } from '@/lib/scheduledPlan'
import { Modal } from './Modal'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

function ownerName(owner: AccountOwner, people: { id: string; name: string }[]): string {
  if (owner === 'joint') return 'Joint'
  const index = owner === 'person_a' ? 0 : 1
  return people[index]?.name ?? (owner === 'person_a' ? 'Person 1' : 'Person 2')
}

function numbersOnly(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
}

function BreakdownRow({
  row,
  people,
  onSave,
  onGrowInstead,
}: {
  row: ContributionBreakdownRow
  people: { id: string; name: string }[]
  onSave: (input: { monthly: number; annualBonus: number }) => Promise<void>
  onGrowInstead: () => void
}) {
  const [monthly, setMonthly] = useState(String(row.monthly))
  const [bonus, setBonus] = useState(String(row.annualBonus))
  const [saving, setSaving] = useState(false)
  const dirty = (Number(monthly) || 0) !== row.monthly || (Number(bonus) || 0) !== row.annualBonus

  const save = async () => {
    setSaving(true)
    try {
      await onSave({ monthly: Number(monthly) || 0, annualBonus: Number(bonus) || 0 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold leading-tight">{ownerName(row.owner, people)}</p>
          <p className="text-[12px] text-muted-foreground">{POT_LABELS[row.potCategory]}</p>
        </div>
        <button
          type="button"
          onClick={onGrowInstead}
          className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Grow %/yr instead
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2">
          <span className="text-[12px] text-muted-foreground">£</span>
          <input
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(numbersOnly(e.target.value))}
            className="w-20 bg-transparent text-[14px] font-semibold tabular-nums outline-none"
          />
          <span className="text-[11px] text-muted-foreground">/mo</span>
        </label>
        <label className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2">
          <span className="text-[12px] text-muted-foreground">£</span>
          <input
            inputMode="decimal"
            value={bonus}
            onChange={(e) => setBonus(numbersOnly(e.target.value))}
            className="w-20 bg-transparent text-[14px] font-semibold tabular-nums outline-none"
          />
          <span className="text-[11px] text-muted-foreground">/yr bonus</span>
        </label>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-30"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function ContributionBreakdown({
  year,
  rows,
  people,
  onSaveRow,
  onGrowInsteadRow,
  onClose,
}: {
  year: number
  rows: ContributionBreakdownRow[]
  people: { id: string; name: string }[]
  onSaveRow: (row: ContributionBreakdownRow, input: { monthly: number; annualBonus: number }) => Promise<void>
  onGrowInsteadRow: (row: ContributionBreakdownRow) => void
  onClose: () => void
}) {
  return (
    <Modal title={`Contributions — ${year}`} onClose={onClose}>
      <p className="text-[13px] text-muted-foreground">
        What each person is putting into each pot, starting {year}. Change any of them below.
      </p>
      <div className="mt-3 max-h-[60vh] divide-y divide-border overflow-y-auto">
        {rows.length === 0 ? (
          <p className="py-3 text-[13px] text-muted-foreground">Nothing to break down yet.</p>
        ) : (
          rows.map((row) => (
            <BreakdownRow
              key={`${row.owner}-${row.potCategory}`}
              row={row}
              people={people}
              onSave={(input) => onSaveRow(row, input)}
              onGrowInstead={() => onGrowInsteadRow(row)}
            />
          ))
        )}
      </div>
    </Modal>
  )
}
