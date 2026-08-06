/**
 * Compiles a new-child input into a bracketed pair of contribution_changes
 * rows — a reduction from the start year, a restore at an explicit end
 * year — mirroring maternityLeave.ts's drop/restore shape exactly. A
 * reduction bigger than the current contribution clamps to 0 here so the
 * preview reads sensibly (never a negative "£/mo"); scheduledPlan.ts's
 * resolveMonthlySchedule would clamp it to the same 0 regardless once the
 * change is live, so this mirrors what actually happens rather than
 * introducing a different rule.
 */
import type { AccountOwner } from '../accountOwner.js'
import type { PotCategory } from '../householdForecast.js'
import type { LifeEventPlan } from './types.js'

export type NewChildInput = {
  owner: AccountOwner
  potCategory: PotCategory
  /** this pot's current normal monthly contribution, as resolved from the
   *  live schedule by the caller — same reasoning as maternityLeave.ts */
  normalMonthlyContribution: number
  /** how much less to contribute per month while costs are higher */
  monthlyCostReduction: number
  startYear: number
  endYear: number
}

/**
 * Null when the input can't produce a sensible plan: an end year at or
 * before the start year (same calendar-year-granularity reasoning as
 * maternityLeave.ts), or a reduction that isn't actually a reduction.
 */
export function buildNewChildPlan(input: NewChildInput): LifeEventPlan | null {
  if (input.endYear <= input.startYear) return null
  if (input.monthlyCostReduction <= 0) return null

  const reducedMonthly = Math.max(0, input.normalMonthlyContribution - input.monthlyCostReduction)

  return {
    summary: `New child — ${input.startYear} to ${input.endYear}`,
    contributionChanges: [
      {
        owner: input.owner,
        potCategory: input.potCategory,
        effectiveYear: input.startYear,
        changeType: 'set',
        value: reducedMonthly,
        note: 'New child — reduced saving for added costs',
      },
      {
        owner: input.owner,
        potCategory: input.potCategory,
        effectiveYear: input.endYear,
        changeType: 'set',
        value: input.normalMonthlyContribution,
        note: 'Saving back to normal',
      },
    ],
    plannedEvents: [],
  }
}
