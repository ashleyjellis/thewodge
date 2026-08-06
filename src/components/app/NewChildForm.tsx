/**
 * New child — an ongoing cost reduction on one pot, bracketed between a
 * start year and an explicit end year (mirrors the maternity-leave
 * drop/restore shape). The JISA idea stays copy-only in v1: a nudge line
 * and a link to Accounts, never an auto-created account — a child isn't
 * modelled as a person in this schema, so that's a real, separate schema
 * decision this form deliberately doesn't make on its own.
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory } from '@/lib/householdForecast'
import type { OwnerScopedContributionChange, ScheduledPlanAccount } from '@/lib/scheduledPlan'
import { resolveContributionBreakdown } from '@/lib/scheduledPlan'
import { buildNewChildPlan } from '@/lib/lifeEvents/newChild'
import type { LifeEventPlan } from '@/lib/lifeEvents/types'
import { money } from '@/lib/format'
import { AppField } from './AppField'
import { AppSelect } from './AppSelect'
import { Modal } from './Modal'
import { PlanUpdatePreview } from './PlanUpdatePreview'
import { NavLink } from '@/components/NavLink'

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

export function NewChildForm({
  people,
  accounts,
  contributionChanges,
  years,
  defaultYear,
  defaultOwner,
  onAddContributionChange,
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
  onBack: () => void
  onClose: () => void
}) {
  const ownerOptions: { value: AccountOwner; label: string }[] = [
    ...(people[0] ? [{ value: 'person_a' as const, label: people[0].name }] : []),
    ...(people[1] ? [{ value: 'person_b' as const, label: people[1].name }] : []),
    { value: 'joint', label: 'Joint' },
  ]

  const [owner, setOwner] = useState<AccountOwner>(defaultOwner)
  const [potCategory, setPotCategory] = useState<PotCategory>('investments')
  const [startYear, setStartYear] = useState(String(defaultYear))
  const [endYear, setEndYear] = useState(String(defaultYear + 1))
  const [reductionInput, setReductionInput] = useState('')
  const [step, setStep] = useState<'form' | 'preview'>('form')

  const normalMonthlyContribution =
    resolveContributionBreakdown({ year: Number(startYear), accounts, changes: contributionChanges }).find(
      (r) => r.owner === owner && r.potCategory === potCategory,
    )?.monthly ?? 0

  const monthlyCostReduction = Number(reductionInput)
  const plan: LifeEventPlan | null =
    reductionInput.trim() !== '' && Number.isFinite(monthlyCostReduction)
      ? buildNewChildPlan({
          owner,
          potCategory,
          normalMonthlyContribution,
          monthlyCostReduction,
          startYear: Number(startYear),
          endYear: Number(endYear),
        })
      : null

  if (step === 'preview' && plan) {
    return (
      <Modal title="Confirm new child" onClose={onClose}>
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
    <Modal title="New child" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <AppSelect
          label="Whose saving"
          value={owner}
          onChange={(v) => setOwner(v as AccountOwner)}
          options={ownerOptions}
        />
        <AppSelect
          label="Pot affected"
          value={potCategory}
          onChange={(v) => setPotCategory(v as PotCategory)}
          options={Object.entries(POT_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <AppSelect
          label="Costs start"
          value={startYear}
          onChange={setStartYear}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <AppSelect
          label="Back to normal"
          value={endYear}
          onChange={setEndYear}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <AppField
          label="Reduce saving by"
          hint={`currently ${money(normalMonthlyContribution)}/mo`}
          prefix="£"
          inputMode="decimal"
          value={reductionInput}
          onChange={setReductionInput}
          placeholder="150"
          className="col-span-2"
        />
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        {plan
          ? `${POT_LABELS[potCategory]} would drop to ${money(plan.contributionChanges[0]!.value)}/mo from ${startYear}, back to ${money(normalMonthlyContribution)}/mo from ${endYear}.`
          : 'Pick a back-to-normal year after the costs-start year, and how much less to save, to see the change.'}
      </p>

      <div className="mt-4 rounded-2xl bg-accent/30 p-4 text-[13px] text-muted-foreground">
        Worth a look: a Junior ISA lets a child's own savings grow tax-free. This app doesn't
        open one for you —{' '}
        <NavLink to="/app2/accounts" className="underline underline-offset-2">
          set one up on the Accounts tab
        </NavLink>{' '}
        if it's right for you.
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
