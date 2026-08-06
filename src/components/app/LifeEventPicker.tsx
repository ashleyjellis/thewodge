/**
 * Replaces the Plan table's "+ Add" going straight to the generic planned-
 * event form — now it asks what's actually changing first. Maternity/
 * paternity leave gets its own typed compiler (statutory pay, a drop/
 * restore pair); "Something else" is the existing generic form, unchanged,
 * kept as the escape hatch for anything not modelled yet (a car, a student
 * loan, ...).
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { OwnerScopedContributionChange, ScheduledPlanAccount } from '@/lib/scheduledPlan'
import { Modal } from './Modal'
import { MaternityLeaveForm } from './MaternityLeaveForm'

type Step = { kind: 'pick' } | { kind: 'maternity_paternity_leave' }

const KIND_OPTIONS: { kind: Step['kind']; label: string; hint: string }[] = [
  {
    kind: 'maternity_paternity_leave',
    label: 'Maternity or paternity leave',
    hint: 'Reduced pay for a stretch, worked out from statutory pay',
  },
]

export function LifeEventPicker({
  people,
  accounts,
  contributionChanges,
  years,
  defaultYear,
  onAddContributionChange,
  onSomethingElse,
  onClose,
}: {
  people: { id: string; name: string; salary: number | null }[]
  accounts: ScheduledPlanAccount[]
  contributionChanges: OwnerScopedContributionChange[]
  years: number[]
  defaultYear: number
  onAddContributionChange: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    effectiveYear: number
    changeType: 'set' | 'grow_pct' | 'annual_bonus'
    value: number
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
