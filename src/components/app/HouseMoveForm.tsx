/**
 * House move — a one-off moving cost, plus an optional change to ongoing
 * saving from that year on (a bigger mortgage often means less left to
 * save). Compiles via houseMove.ts into a planned_events row and an
 * optional second contribution_changes row.
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { OwnerScopedContributionChange, ScheduledPlanAccount } from '@/lib/scheduledPlan'
import { resolveContributionBreakdown } from '@/lib/scheduledPlan'
import { buildHouseMovePlan } from '@/lib/lifeEvents/houseMove'
import type { LifeEventPlan } from '@/lib/lifeEvents/types'
import { money } from '@/lib/format'
import { AppField } from './AppField'
import { AppSelect } from './AppSelect'
import { FilterPill } from './FilterPill'
import { Modal } from './Modal'
import { PlanUpdatePreview } from './PlanUpdatePreview'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

export function HouseMoveForm({
  people,
  accounts,
  contributionChanges,
  years,
  defaultYear,
  defaultOwner,
  onAddContributionChange,
  onAddPlannedEvent,
  onBack,
  onClose,
}: {
  people: { id: string; name: string }[]
  accounts: ScheduledPlanAccount[]
  contributionChanges: OwnerScopedContributionChange[]
  years: number[]
  defaultYear: number
  defaultOwner: AccountOwner
  onAddContributionChange: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    effectiveYear: number
    changeType: 'set' | 'grow_pct' | 'annual_bonus'
    value: number
    note?: string
  }) => Promise<void>
  onAddPlannedEvent: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    year: number
    name: string
    amount: number
    note?: string
  }) => Promise<void>
  onBack: () => void
  onClose: () => void
}) {
  const ownerOptions: { value: AccountOwner; label: string }[] = [
    ...(people[0] ? [{ value: 'person_a' as const, label: people[0].name }] : []),
    ...(people[1] ? [{ value: 'person_b' as const, label: people[1].name }] : []),
    { value: 'joint', label: 'Joint' },
  ]

  const [owner, setOwner] = useState<AccountOwner>(defaultOwner)
  const [potCategory, setPotCategory] = useState<PotCategory>('cash')
  const [year, setYear] = useState(String(defaultYear))
  const [moveCostInput, setMoveCostInput] = useState('')
  const [changesSaving, setChangesSaving] = useState(false)
  const [newMonthlyInput, setNewMonthlyInput] = useState('')
  const [step, setStep] = useState<'form' | 'preview'>('form')

  const normalMonthlyContribution =
    resolveContributionBreakdown({ year: Number(year), accounts, changes: contributionChanges }).find(
      (r) => r.owner === owner && r.potCategory === potCategory,
    )?.monthly ?? 0

  const moveCost = Number(moveCostInput)
  const newMonthlyContribution = changesSaving && newMonthlyInput.trim() !== '' ? Number(newMonthlyInput) : null
  const plan: LifeEventPlan | null =
    moveCostInput.trim() !== '' && Number.isFinite(moveCost)
      ? buildHouseMovePlan({
          owner,
          potCategory,
          year: Number(year),
          moveCost,
          normalMonthlyContribution,
          newMonthlyContribution,
        })
      : null

  if (step === 'preview' && plan) {
    return (
      <Modal title="Confirm house move" onClose={onClose}>
        <PlanUpdatePreview
          plan={plan}
          people={people}
          onBack={() => setStep('form')}
          onConfirm={async () => {
            for (const event of plan.plannedEvents) {
              await onAddPlannedEvent({ ...event })
            }
            for (const change of plan.contributionChanges) {
              await onAddContributionChange({ ...change })
            }
            onClose()
          }}
        />
      </Modal>
    )
  }

  return (
    <Modal title="House move" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <AppSelect
          label="Whose"
          value={owner}
          onChange={(v) => setOwner(v as AccountOwner)}
          options={ownerOptions}
        />
        <AppSelect
          label="Pot the cost comes from"
          value={potCategory}
          onChange={(v) => setPotCategory(v as PotCategory)}
          options={Object.entries(POT_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <AppSelect label="Year" value={year} onChange={setYear} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
        <AppField
          label="Moving cost"
          hint="deposit, fees, all of it"
          prefix="£"
          inputMode="decimal"
          value={moveCostInput}
          onChange={setMoveCostInput}
          placeholder="15,000"
        />
      </div>

      <div className="mt-4">
        <FilterPill active={changesSaving} onClick={() => setChangesSaving((v) => !v)}>
          Ongoing saving changes after the move
        </FilterPill>
      </div>

      {changesSaving ? (
        <div className="mt-3">
          <AppField
            label={`New monthly ${POT_LABELS[potCategory]} contribution`}
            hint={`currently ${money(normalMonthlyContribution)}/mo`}
            prefix="£"
            inputMode="decimal"
            value={newMonthlyInput}
            onChange={setNewMonthlyInput}
            placeholder="350"
          />
        </div>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          disabled={!plan}
          onClick={() => setStep('preview')}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back
        </button>
      </div>
    </Modal>
  )
}
