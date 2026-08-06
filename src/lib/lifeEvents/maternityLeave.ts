/**
 * Compiles a typed maternity/paternity-leave input into exactly two
 * contribution_changes rows on one chosen pot — a drop at leave-start, a
 * restore at an explicit return-to-work date. The return date is its own
 * field, not derived from the statutory paid duration: real return-to-work
 * dates commonly differ from it. Zero engine changes — purely a compiler
 * onto scheduledPlan.ts's existing 'set' primitive, which already fully
 * replaces one pot's monthly figure from a given year, exactly the
 * drop/restore shape this needs.
 *
 * The reduction is proportional: the pot's normal monthly contribution is
 * scaled down by the same ratio the person's income drops to statutory
 * pay, so someone who saves 20% of salary keeps saving roughly 20% of
 * their (lower) statutory pay, rather than either freezing the pot
 * entirely or leaving it untouched.
 */
import type { AccountOwner } from '../accountOwner.js'
import type { PotCategory } from '../householdForecast.js'
import { calculateStatutoryPay, type LeaveType } from './statutoryPay.js'
import type { LifeEventPlan } from './types.js'

export type MaternityLeaveInput = {
  personName: string
  owner: AccountOwner
  potCategory: PotCategory
  leaveType: LeaveType
  annualSalary: number
  /** this pot's current normal monthly contribution, as resolved from the
   *  live schedule by the caller (resolveContributionBreakdown) — kept as
   *  a plain input so this function stays a pure compiler, not a re-lookup */
  normalMonthlyContribution: number
  leaveStartYear: number
  returnYear: number
}

const POT_LABELS: Record<PotCategory, string> = {
  pension: 'Pension',
  investments: 'Investments',
  cash: 'Cash savings',
}

/**
 * Null when the input can't produce a sensible plan: a return date at or
 * before leave-start (this app's schedule is calendar-year granularity — a
 * same-year round trip would have the restore silently cancel the drop
 * before it ever shows up), or no salary to base statutory pay on.
 */
export function buildMaternityLeavePlan(input: MaternityLeaveInput): LifeEventPlan | null {
  if (input.returnYear <= input.leaveStartYear) return null
  if (input.annualSalary <= 0) return null

  const pay = calculateStatutoryPay(input.annualSalary, input.leaveType)
  const normalMonthlySalary = input.annualSalary / 12
  const incomeRatio = normalMonthlySalary > 0 ? pay.blendedMonthlyPay / normalMonthlySalary : 0
  const reducedMonthly = Math.max(0, input.normalMonthlyContribution * incomeRatio)

  const leaveLabel = input.leaveType === 'maternity' ? 'Maternity leave' : 'Paternity leave'
  const potLabel = POT_LABELS[input.potCategory]

  return {
    summary: `${leaveLabel} — ${input.personName}, ${input.leaveStartYear} to ${input.returnYear}`,
    contributionChanges: [
      {
        owner: input.owner,
        potCategory: input.potCategory,
        effectiveYear: input.leaveStartYear,
        changeType: 'set',
        value: reducedMonthly,
        note: `${leaveLabel} starts — ${potLabel} reduced with statutory pay`,
      },
      {
        owner: input.owner,
        potCategory: input.potCategory,
        effectiveYear: input.returnYear,
        changeType: 'set',
        value: input.normalMonthlyContribution,
        note: `Back to work after ${leaveLabel.toLowerCase()}`,
      },
    ],
    plannedEvents: [],
  }
}
