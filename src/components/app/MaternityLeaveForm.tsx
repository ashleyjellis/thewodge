/**
 * Maternity/paternity leave — collects who, which pot, and the two years
 * (leave-start, back-to-work), then compiles them via maternityLeave.ts
 * into a drop/restore pair on that one pot. Salary and the pot's current
 * monthly contribution are looked up, not re-typed — this app already
 * knows both (person.salary; resolveContributionBreakdown for the pot).
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { OwnerScopedContributionChange, ScheduledPlanAccount } from '@/lib/scheduledPlan'
import { resolveContributionBreakdown } from '@/lib/scheduledPlan'
import { buildMaternityLeavePlan } from '@/lib/lifeEvents/maternityLeave'
import { calculateStatutoryPay, type LeaveType } from '@/lib/lifeEvents/statutoryPay'
import type { LifeEventPlan } from '@/lib/lifeEvents/types'
import { money, percent } from '@/lib/format'
import { AppSelect } from './AppSelect'
import { FilterPill } from './FilterPill'
import { Modal } from './Modal'
import { PlanUpdatePreview } from './PlanUpdatePreview'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

export function MaternityLeaveForm({
  people,
  accounts,
  contributionChanges,
  years,
  defaultYear,
  onAddContributionChange,
  onBack,
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
  onBack: () => void
  onClose: () => void
}) {
  const salaryOwners: { value: AccountOwner; label: string; salary: number }[] = [
    ...(people[0]?.salary ? [{ value: 'person_a' as const, label: people[0].name, salary: people[0].salary }] : []),
    ...(people[1]?.salary ? [{ value: 'person_b' as const, label: people[1].name, salary: people[1].salary }] : []),
  ]

  const [owner, setOwner] = useState<AccountOwner>(salaryOwners[0]?.value ?? 'person_a')
  const [potCategory, setPotCategory] = useState<PotCategory>('investments')
  const [leaveType, setLeaveType] = useState<LeaveType>('maternity')
  const [leaveStartYear, setLeaveStartYear] = useState(String(defaultYear))
  const [returnYear, setReturnYear] = useState(String(defaultYear + 1))
  const [step, setStep] = useState<'form' | 'preview'>('form')

  if (salaryOwners.length === 0) {
    return (
      <Modal title="Maternity or paternity leave" onClose={onClose}>
        <p className="text-[13px] text-muted-foreground">
          This needs a salary on file to work out statutory pay — add one for at least one
          person on the Accounts tab first.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back
        </button>
      </Modal>
    )
  }

  const person = salaryOwners.find((o) => o.value === owner) ?? salaryOwners[0]!
  const normalMonthlyContribution =
    resolveContributionBreakdown({ year: Number(leaveStartYear), accounts, changes: contributionChanges }).find(
      (r) => r.owner === owner && r.potCategory === potCategory,
    )?.monthly ?? 0

  const pay = calculateStatutoryPay(person.salary, leaveType)
  const plan: LifeEventPlan | null = buildMaternityLeavePlan({
    personName: person.label,
    owner,
    potCategory,
    leaveType,
    annualSalary: person.salary,
    normalMonthlyContribution,
    leaveStartYear: Number(leaveStartYear),
    returnYear: Number(returnYear),
  })

  if (step === 'preview' && plan) {
    return (
      <Modal title="Confirm maternity/paternity leave" onClose={onClose}>
        <PlanUpdatePreview
          plan={plan}
          people={people}
          onBack={() => setStep('form')}
          onConfirm={async () => {
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
    <Modal title="Maternity or paternity leave" onClose={onClose}>
      <div className="flex gap-1">
        <FilterPill active={leaveType === 'maternity'} onClick={() => setLeaveType('maternity')}>
          Maternity
        </FilterPill>
        <FilterPill active={leaveType === 'paternity'} onClick={() => setLeaveType('paternity')}>
          Paternity
        </FilterPill>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <AppSelect
          label="Whose"
          value={owner}
          onChange={(v) => setOwner(v as AccountOwner)}
          options={salaryOwners.map((o) => ({ value: o.value, label: o.label }))}
        />
        <AppSelect
          label="Pot affected"
          value={potCategory}
          onChange={(v) => setPotCategory(v as PotCategory)}
          options={Object.entries(POT_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <AppSelect
          label="Leave starts"
          value={leaveStartYear}
          onChange={setLeaveStartYear}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <AppSelect
          label="Back to work"
          value={returnYear}
          onChange={setReturnYear}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
      </div>

      <div className="mt-4 rounded-2xl bg-accent/30 p-4 text-[13px]">
        <p className="text-muted-foreground">
          Statutory pay works out to about{' '}
          <span className="font-semibold text-foreground">{money(pay.blendedMonthlyPay)}/mo</span> —{' '}
          {percent(pay.blendedMonthlyPay / (person.salary / 12))} of normal salary.
        </p>
        <p className="mt-1 text-muted-foreground">
          Currently contributing {money(normalMonthlyContribution)}/mo to {POT_LABELS[potCategory]} —
          {plan ? (
            <> would drop to <span className="font-semibold text-foreground">{money(plan.contributionChanges[0]!.value)}/mo</span> while on leave.</>
          ) : (
            ' pick a back-to-work year after the leave-start year to see the drop.'
          )}
        </p>
      </div>

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
