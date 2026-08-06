/**
 * Replaces the Plan table's "+ Add" going straight to the generic planned-
 * event form — now it asks what's actually changing first. Maternity/
 * paternity leave, house move, and new child each get their own typed
 * compiler; "Something else" is the existing generic form, unchanged, kept
 * as the escape hatch for anything not modelled yet (a car, a student
 * loan, ...).
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { OwnerScopedContributionChange, ScheduledPlanAccount } from '@/lib/scheduledPlan'
import { Modal } from './Modal'
import { MaternityLeaveForm } from './MaternityLeaveForm'
import { HouseMoveForm } from './HouseMoveForm'
import { NewChildForm } from './NewChildForm'

type Kind = 'maternity_paternity_leave' | 'house_move' | 'new_child'
type Step = { kind: 'pick' } | { kind: Kind }

const KIND_OPTIONS: { kind: Kind; label: string; hint: string }[] = [
  {
    kind: 'maternity_paternity_leave',
    label: 'Maternity or paternity leave',
    hint: 'Reduced pay for a stretch, worked out from statutory pay',
  },
  {
    kind: 'house_move',
    label: 'House move',
    hint: 'A one-off moving cost, and a possible change to ongoing saving',
  },
  {
    kind: 'new_child',
    label: 'New child',
    hint: 'Reduced saving for added costs, for as long as you choose',
  },
]

export function LifeEventPicker({
  people,
  accounts,
  contributionChanges,
  years,
  defaultYear,
  defaultOwner,
  onAddContributionChange,
  onAddPlannedEvent,
  onSomethingElse,
  onClose,
}: {
  people: { id: string; name: string; salary: number | null }[]
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
  onSomethingElse: () => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>({ kind: 'pick' })

  if (step.kind === 'maternity_paternity_leave') {
    return (
      <MaternityLeaveForm
        people={people}
        accounts={accounts}
        contributionChanges={contributionChanges}
        years={years}
        defaultYear={defaultYear}
        onAddContributionChange={onAddContributionChange}
        onBack={() => setStep({ kind: 'pick' })}
        onClose={onClose}
      />
    )
  }

  if (step.kind === 'house_move') {
    return (
      <HouseMoveForm
        people={people}
        accounts={accounts}
        contributionChanges={contributionChanges}
        years={years}
        defaultYear={defaultYear}
        defaultOwner={defaultOwner}
        onAddContributionChange={onAddContributionChange}
        onAddPlannedEvent={onAddPlannedEvent}
        onBack={() => setStep({ kind: 'pick' })}
        onClose={onClose}
      />
    )
  }

  if (step.kind === 'new_child') {
    return (
      <NewChildForm
        people={people}
        accounts={accounts}
        contributionChanges={contributionChanges}
        years={years}
        defaultYear={defaultYear}
        defaultOwner={defaultOwner}
        onAddContributionChange={onAddContributionChange}
        onBack={() => setStep({ kind: 'pick' })}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal title="What's changing?" onClose={onClose}>
      <div className="space-y-2">
        {KIND_OPTIONS.map((opt) => (
          <button
            key={opt.kind}
            type="button"
            onClick={() => setStep({ kind: opt.kind })}
            className="block w-full rounded-2xl bg-muted/60 p-4 text-left transition-colors hover:bg-muted"
          >
            <p className="text-[14px] font-semibold">{opt.label}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{opt.hint}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={onSomethingElse}
          className="block w-full rounded-2xl bg-muted/60 p-4 text-left transition-colors hover:bg-muted"
        >
          <p className="text-[14px] font-semibold">Something else</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            A one-off amount in or out, at a year you choose
          </p>
        </button>
      </div>
    </Modal>
  )
}
